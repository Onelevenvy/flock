use crate::sandbox_core::daytona::{
    start_computer_use_in_sandbox,
    DISPLAY_ID,
};
use crate::sandbox_core::manager::{
    execute_command_in_sandbox,
    get_sandbox_vnc_url,
    ensure_vnc_running_in_sandbox,
};
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::db::DbManager;
use base64::{Engine as _, engine::general_purpose};

use super::helpers::extract_and_save_screenshot;

/// Handle the "interactive" browser action: launch VNC desktop, analyze page for
/// security elements, optionally trigger human takeover, and return result.
pub async fn handle_interactive(
    db: &DbManager,
    sandbox_id: &str,
    session_id: &str,
    name_id: &str,
    url: &str,
    call_id: Option<String>,
    msg_id: Option<String>,
) -> Result<String, String> {
    let proxy_url = match get_sandbox_vnc_url(db, sandbox_id).await {
        Ok(u) => u,
        Err(e) => {
            crate::emit_info(&flock_core::tr(
                &format!("获取 VNC URL 失败: {}", e),
                &format!("Failed to get VNC URL: {}", e)
            ));
            return Err(format!("无法获取沙盒 VNC 连接地址: {}", e));
        }
    };

    crate::emit_info(&flock_core::tr(
        "正在向云端申请启动桌面服务...",
        "Requesting cloud desktop service startup...",
    ));
    if let Err(e) = start_computer_use_in_sandbox(db, sandbox_id).await {
        crate::emit_info(&flock_core::tr(
            &format!("启动 Daytona 桌面服务请求失败: {}。尝试备用手动方案...", e),
            &format!("Daytona desktop service launch request failed: {}. Attempting fallback manual procedure...", e),
        ));
    }

    let _ = ensure_vnc_running_in_sandbox(db, sandbox_id).await;

    // Ensure headful Chromium with CDP on port 9222
    crate::emit_info(&flock_core::tr(
        "正在远程桌面中初始化开启远程调试 (9222) 的浏览器...",
        "Initializing browser with remote debugging (9222) enabled on remote desktop...",
    ));
    let check_and_start_cmd = format!(
        "export DISPLAY={display} && \
         if ! python3 -c 'import socket; s = socket.socket(); s.connect((\"127.0.0.1\", 9222))' >/dev/null 2>&1; then \
             echo 'Starting chromium exposing 9222 debugger port on DISPLAY={display}...' && \
             if command -v chromium >/dev/null 2>&1; then \
                 setsid nohup chromium --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --window-size=1280,1024 >/tmp/interactive_chrome.log 2>&1 & \
             elif command -v chromium-browser >/dev/null 2>&1; then \
                 setsid nohup chromium-browser --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --window-size=1280,1024 >/tmp/interactive_chrome.log 2>&1 & \
             elif command -v google-chrome >/dev/null 2>&1; then \
                 setsid nohup google-chrome --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --window-size=1280,1024 >/tmp/interactive_chrome.log 2>&1 & \
             fi && \
             sleep 3; \
         fi",
        display = DISPLAY_ID
    );
    let _ = execute_command_in_sandbox(db, sandbox_id, &check_and_start_cmd).await;

    let (need_takeover, has_password, has_captcha, screenshot_saved) =
        run_security_check(db, sandbox_id, session_id, name_id, url).await?;

    let base_dir = crate::get_workspace_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let abs_screenshot_path = base_dir
        .join(".flock/sandbox/screenshots")
        .join(session_id)
        .join(format!("{}.png", name_id));
    let abs_path_str = abs_screenshot_path.to_string_lossy().to_string();

    let image_md = if screenshot_saved {
        format!(
            "\n\n网页截图已完美捕获，您可以在右侧预览面板或下方查看历史记录回放：\n\n![网页截图](file:///{})",
            abs_path_str
        )
    } else {
        String::new()
    };

    if !need_takeover {
        return Ok(format!(
            "人机协同远程桌面已拉起！网页分析完成：未检测到输入密码 (has_password: {})、验证码 (has_captcha: {}) 等敏感验证元素。**为了提高大模型执行效率，已自动跳过人工接管，Agent 继续流式自动运转。**{}\n\n[Remote VNC Link]({})",
            has_password, has_captcha, image_md, proxy_url
        ));
    }

    // Sensitive elements detected — trigger human takeover
    if let (Some(cid), Some(mid), Some(app_mgr)) =
        (call_id, msg_id, crate::get_global_approval_manager())
    {
        crate::emit_info(&flock_core::tr(
            &format!("检测到敏感网页元素（密码输入框/验证码），正在通知前端拉起人工接管横幅 (Call ID: {})...", cid),
            &format!("Sensitive page element detected (password input/captcha), notifying client to display takeover banner (Call ID: {})...", cid),
        ));
        crate::sandbox_core::state::emit_human_takeover(
            &cid,
            &mid,
            "人机协同远程桌面已拉起！检测到当前操作需要人工介入（如输入密码、手动验证码、安全登录等），大模型自动执行已暂停。您可以在右侧预览面板中直接操作页面。完成后请点击横幅上的【我已完成操作】按钮以恢复大模型的自动运行。",
            Some(proxy_url.clone()),
        );

        let rx = app_mgr.request_approval(&cid, &ToolCategory::Exec);
        match rx.await {
            Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Approved { .. }) => {
                crate::emit_info(&flock_core::tr(
                    "收到前端已完成操作指令，正在恢复 Agent 自动执行。",
                    "Received completion signal from frontend. Resuming automated Agent execution.",
                ));
                return Ok(format!(
                    "人工接管操作已顺利完成，用户已确认！Agent 已经成功从暂停点恢复，并继续自动执行后续流程。{}",
                    image_md
                ));
            }
            Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Denied { reason }) => {
                crate::emit_info(&flock_core::tr(
                    &format!("人工接管被用户取消: {}", reason),
                    &format!("Human takeover cancelled by user: {}", reason),
                ));
                return Err(format!("人工接管被取消，原因为: {}", reason));
            }
            Err(e) => {
                crate::emit_info(&flock_core::tr(
                    &format!("人工接管等待通道意外中断: {}", e),
                    &format!("Human takeover wait channel interrupted unexpectedly: {}", e),
                ));
            }
        }
    }

    Ok(format!(
        "人机协同远程桌面已拉起！由于当前操作需要人工介入（如输入密码、手动验证码、安全登录等），大模型自动执行已暂停。请在右侧预览区进行控制操作。\n\n[Remote VNC Link]({}){}",
        proxy_url, image_md
    ))
}

/// Run the security check script, save screenshot, and return analysis results.
async fn run_security_check(
    db: &DbManager,
    sandbox_id: &str,
    session_id: &str,
    name_id: &str,
    url: &str,
) -> Result<(bool, bool, bool, bool), String> {
    let py_check_script_template = include_str!("../scripts/browser_security_check.py");
    let url_b64 = general_purpose::STANDARD.encode(url.as_bytes());
    let py_check_script = py_check_script_template.replace("###URL_B64###", &url_b64);

    let b64_script = general_purpose::STANDARD.encode(py_check_script.as_bytes());
    let run_check_cmd = format!(
        "export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers && \
         export DISPLAY={display} && \
         mkdir -p /tmp && echo '{}' | base64 -d > /tmp/run_interactive.py && \
         if ! python3 -c 'import playwright' >/dev/null 2>&1; then \
             echo 'Installing playwright...' && \
             python3 -m pip install --break-system-packages playwright && \
             python3 -m playwright install chromium && \
             python3 -m playwright install-deps chromium; \
         fi; \
         python3 /tmp/run_interactive.py",
        b64_script,
        display = DISPLAY_ID
    );

    let (stdout_stderr, _exit_code) = execute_command_in_sandbox(db, sandbox_id, &run_check_cmd)
        .await
        .map_err(|e| format!("网页分析执行出错: {}", e))?;

    let mut need_takeover = false;
    let mut has_password = false;
    let mut has_captcha = false;

    for line in stdout_stderr.lines() {
        if let Some(stripped) = line.strip_prefix("CHECK_RESULT:") {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(stripped) {
                need_takeover = val.get("need_takeover").and_then(|v| v.as_bool()).unwrap_or(false);
                has_password = val.get("has_password").and_then(|v| v.as_bool()).unwrap_or(false);
                has_captcha = val.get("has_captcha").and_then(|v| v.as_bool()).unwrap_or(false);
            }
        }
    }

    let (_, screenshot_saved) = extract_and_save_screenshot(&stdout_stderr, session_id, name_id, "");

    Ok((need_takeover, has_password, has_captcha, screenshot_saved))
}
