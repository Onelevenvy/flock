use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::{
    get_or_create_active_sandbox, execute_command_in_sandbox,
    start_computer_use_in_sandbox, check_computer_use_status,
    ensure_vnc_running_in_sandbox, DISPLAY_ID, WEBSOCKIFY_PORT
};
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

/// A cloud-based web browser tool for rendering web pages, taking screenshots, and performing interactions.
///
/// ## Core Features and Action Specification
/// - Supported actions:
///   * `goto`: Open the target URL and render the page.
///   * `click_id`: (RECOMMENDED) Click on an element identified by its extracted `element_id`.
///   * `fill_id`: (RECOMMENDED) Type text into an input field identified by its extracted `element_id`.
///   * `click_coord`: Click by explicit X, Y coordinates (requires `x` and `y`).
///   * `click`: Click via CSS selector (fallback, requires `selector`).
///   * `fill`: Type text via CSS selector (fallback, requires `selector` and `text`).
///   * `scroll_down` / `scroll_up`: Scroll the page.
///   * `press_key`: Simulate pressing a keyboard key (e.g. "Enter").
///   * `interactive`: Human takeover mode.
///
/// ## 1. Visual Feedback & Element ID Usage
/// - The tool automatically extracts the interactive DOM nodes and assigns them an `element_id`.
/// - You will receive a DOM map (e.g. `[12] input "Search" (x: 150, y: 300)`) along with a screenshot.
/// - **Always prefer using `click_id` / `fill_id` / `click_coord` over brittle CSS selectors.**
///
/// ## 2. Manual Intervention Guide
/// - When encountering captchas or 2FA, immediately use `action="interactive"`.
///
/// @param url The target website URL.
/// @param action (Optional) The browser action to perform. MUST be one of: 'goto' (navigate to URL), 'click_id' (click element by numeric ID from DOM Tree), 'fill_id' (fill text input by numeric ID from DOM Tree), 'click_coord' (click specific coordinate x,y), 'click' (click by selector), 'fill' (type by selector), 'scroll_down' (scroll down page), 'scroll_up' (scroll up page), 'press_key' (press keyboard key), 'interactive' (human takeover). Defaults to 'goto'.
/// @param selector Optional CSS selector.
/// @param text Optional text to fill.
/// @param element_id Optional ID from the extracted DOM map.
/// @param x Optional X coordinate.
/// @param y Optional Y coordinate.
/// @param key Optional key to press (e.g. "Enter", "Tab").
fn clean_b64_from_output(s: &str) -> String {
    let mut temp = String::new();
    let raw_start = "RAW_SCREENSHOT_B64_START";
    let raw_end = "RAW_SCREENSHOT_B64_END";
    let mut current_pos = 0;
    
    while let Some(start_idx) = s[current_pos..].find(raw_start) {
        let absolute_start = current_pos + start_idx;
        temp.push_str(&s[current_pos..absolute_start]);
        temp.push_str(raw_start);
        temp.push_str("\n[干净截图二进制Base64数据已自动折叠]\n");
        
        let rest = &s[absolute_start + raw_start.len()..];
        if let Some(end_idx) = rest.find(raw_end) {
            temp.push_str(raw_end);
            current_pos = absolute_start + raw_start.len() + end_idx + raw_end.len();
        } else {
            current_pos = s.len();
            break;
        }
    }
    if current_pos < s.len() {
        temp.push_str(&s[current_pos..]);
    }

    let start_marker = "SCREENSHOT_B64_START";
    let end_marker = "SCREENSHOT_B64_END";
    
    let mut result = String::new();
    let mut current_pos = 0;
    
    while let Some(start_idx) = temp[current_pos..].find(start_marker) {
        let absolute_start = current_pos + start_idx;
        result.push_str(&temp[current_pos..absolute_start]);
        result.push_str(start_marker);
        result.push_str("\n[截图二进制Base64数据已自动折叠]\n");
        
        let rest = &temp[absolute_start + start_marker.len()..];
        if let Some(end_idx) = rest.find(end_marker) {
            result.push_str(end_marker);
            current_pos = absolute_start + start_marker.len() + end_idx + end_marker.len();
        } else {
            current_pos = temp.len();
            break;
        }
    }
    
    if current_pos < temp.len() {
        result.push_str(&temp[current_pos..]);
    }
    result
}

#[tool("Browser")]
pub async fn browser(
    url: Option<String>,
    action: Option<String>,
    selector: Option<String>,
    text: Option<String>,
    element_id: Option<i32>,
    x: Option<i32>,
    y: Option<i32>,
    key: Option<String>,
    call_id: Option<String>,
    msg_id: Option<String>,
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    let session_id = flock_core::get_current_session_id();

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    let mut act = action.unwrap_or_else(|| "goto".to_string()).to_lowercase();
    if act == "open" || act == "navigate" {
        act = "goto".to_string();
    }
    
    // 大模型智能自愈与动作自动修正
    if act == "act" {
        if element_id.is_some() {
            act = "click_id".to_string();
        } else if selector.is_some() {
            act = "click".to_string();
        } else if x.is_some() && y.is_some() {
            act = "click_coord".to_string();
        } else {
            act = "click".to_string();
        }
    }
    if act == "click" && element_id.is_some() {
        act = "click_id".to_string();
    }
    if act == "fill" && element_id.is_some() {
        act = "fill_id".to_string();
    }
    
    // 如果是 goto 或 interactive 动作，必须提供 url 参数
    if (act == "goto" || act == "interactive") && url.is_none() {
        return Err("执行 goto 或 interactive 操作时，必须提供 url 参数。".to_string());
    }
    
    // 生成唯一的截图标识
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let name_id = call_id.clone().unwrap_or_else(|| now_ms.to_string());
    
    // 如果是 interactive 人工接管模式，我们直接返回远程桌面的 noVNC 代理链接，让前端渲染
    if act == "interactive" {
        let proxy_url = match crate::daytona::get_sandbox_vnc_url(&db, &sandbox_id).await {
            Ok(u) => u,
            Err(e) => {
                crate::emit_info(&format!("获取动态 VNC URL 失败: {}。使用静态备用 URL...", e));
                format!("https://{}-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", WEBSOCKIFY_PORT, sandbox_id)
            }
        };
        
        crate::emit_info("正在向云端申请启动桌面服务...");
        if let Err(e) = start_computer_use_in_sandbox(&db, &sandbox_id).await {
            crate::emit_info(&format!("启动 Daytona 桌面服务请求失败: {}。尝试备用手动方案...", e));
        }

        // 调用统一的自愈拉起函数，确保 Xvfb, fluxbox, x11vnc, websockify 在 0.0.0.0 运行且 setsid 保活
        let _ = ensure_vnc_running_in_sandbox(&db, &sandbox_id).await;

        // 确保有头 Chromium 已拉起且开启了 CDP 调试端口 9222
        crate::emit_info("正在远程桌面中初始化开启远程调试 (9222) 的浏览器...");
        let check_and_start_cmd = format!(
            "export DISPLAY={display} && \
            if ! python3 -c 'import socket; s = socket.socket(); s.connect((\"127.0.0.1\", 9222))' >/dev/null 2>&1; then \
                echo 'Starting chromium exposing 9222 debugger port on DISPLAY={display}...' && \
                if command -v chromium >/dev/null 2>&1; then \
                    setsid nohup chromium --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-software-rasterizer >/tmp/interactive_chrome.log 2>&1 & \
                elif command -v chromium-browser >/dev/null 2>&1; then \
                    setsid nohup chromium-browser --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-software-rasterizer >/tmp/interactive_chrome.log 2>&1 & \
                elif command -v google-chrome >/dev/null 2>&1; then \
                    setsid nohup google-chrome --no-sandbox --remote-debugging-port=9222 --disable-gpu >/tmp/interactive_chrome.log 2>&1 & \
                fi && \
                sleep 3; \
            fi",
            display = DISPLAY_ID
        );
        let _ = execute_command_in_sandbox(&db, &sandbox_id, &check_and_start_cmd).await;

        // 运行网页 analysis 脚本，并自动跳转
        let target_url = url.clone().unwrap_or_default();
        crate::emit_info(&format!("正在远程浏览器中打开网页并分析安全要素: {}...", target_url));
        let py_check_script_template = include_str!("scripts/browser_security_check.py");
        let url_b64 = general_purpose::STANDARD.encode(target_url.as_bytes());
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

        let (stdout_stderr, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &run_check_cmd).await
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

        // 保存网页截图
        let start_marker = "SCREENSHOT_B64_START";
        let end_marker = "SCREENSHOT_B64_END";
        let mut screenshot_saved = false;

        if let Some(start_idx) = stdout_stderr.find(start_marker) {
            if let Some(end_idx) = stdout_stderr.find(end_marker) {
                let b64_data = &stdout_stderr[start_idx + start_marker.len()..end_idx].trim();
                if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data) {
                    let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
                    let ss_dir = base_dir.join(".flock/sandbox/screenshots").join(&session_id);
                    let ss_path = ss_dir.join(format!("{}.png", name_id));
                    if let Some(parent) = ss_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let _ = std::fs::write(&ss_path, &img_bytes);
                    screenshot_saved = true;
                    // 同时保留一份覆盖的 screenshot.png 兼容以前的设计
                    let _ = std::fs::write(base_dir.join(format!(".flock/sandbox/screenshot_{}.png", session_id)), &img_bytes);
                }
            }
        }

        let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        let abs_screenshot_path = base_dir.join(".flock/sandbox/screenshots").join(&session_id).join(format!("{}.png", name_id));
        let abs_path_str = abs_screenshot_path.to_string_lossy().to_string();

        let image_md = if screenshot_saved {
            format!("\n\n网页截图已完美捕获，您可以在右侧预览面板或下方查看历史记录回放：\n\n![网页截图](file:///{})", abs_path_str)
        } else {
            String::new()
        };

        if !need_takeover {
            crate::emit_info("网页分析完毕：未检测到输入密码、验证码等敏感校验元素。自动跳过人机接管。");
            return Ok(format!(
                "人机协同远程桌面已拉起！网页分析完成：未检测到输入密码 (has_password: {})、验证码 (has_captcha: {}) 等敏感验证元素。**为了提高大模型执行效率，已自动跳过人工接管，Agent 继续流式自动运转。**{}\n\n[Remote VNC Link]({})",
                has_password, has_captcha, image_md, proxy_url
            ));
        }

        // 如果检测到了敏感元素，并且有 call_id 且能拿到全局 approval_manager，进行挂起
        if let (Some(cid), Some(mid), Some(app_mgr)) = (call_id.clone(), msg_id, crate::get_global_approval_manager()) {
            crate::emit_info(&format!("检测到敏感网页元素（密码输入框/验证码），正在通知前端拉起人工接管横幅 (Call ID: {})...", cid));
            crate::daytona::emit_human_takeover(
                &cid,
                &mid,
                "人机协同远程桌面已拉起！检测到当前操作需要人工介入（如输入密码、手动验证码、安全登录等），大模型自动执行已暂停。您可以在右侧预览面板中直接操作页面。完成后请点击横幅上的【我已完成操作】按钮以恢复大模型的自动运行。",
                Some(proxy_url.clone()),
            );

            // 用 oneshot 信道等待前端发来的 resolve/approve 结果
            let rx = app_mgr.request_approval(&cid, &ToolCategory::Exec);
            match rx.await {
                Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Approved) => {
                    crate::emit_info("收到前端已完成操作指令，正在恢复 Agent 自动执行。");
                    return Ok(format!(
                        "人工接管操作已顺利完成，用户已确认！Agent 已经成功从暂停点恢复，并继续自动执行后续流程。{}",
                        image_md
                    ));
                }
                Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Denied { reason }) => {
                    crate::emit_info(&format!("人工接管被用户取消: {}", reason));
                    return Err(format!("人工接管被取消，原因为: {}", reason));
                }
                Err(e) => {
                    crate::emit_info(&format!("人工接管等待通道意外中断: {}", e));
                }
            }
        }

        return Ok(format!(
            "人机协同远程桌面已拉起！由于当前操作需要人工介入（如输入密码、手动验证码、安全登录等），大模型自动执行已暂停。请在右侧预览区进行控制操作。\n\n[Remote VNC Link]({}){}",
            proxy_url, image_md
        ));
    }

    let py_script_template = include_str!("scripts/browser_actions.py");
    let config_json = serde_json::json!({
        "url": url,
        "action": act,
        "selector": selector,
        "text": text,
        "element_id": element_id,
        "x": x,
        "y": y,
        "key": key
    });
    let config_b64 = general_purpose::STANDARD.encode(config_json.to_string().as_bytes());
    let py_script = py_script_template.replace("###CONFIG_B64###", &config_b64);

    // 确保 VNC 桌面服务在沙盒中同步先拉起，保证 headful 浏览器启动有 X 桌面环境
    let _ = ensure_vnc_running_in_sandbox(&db, &sandbox_id).await;

    let b64_script = general_purpose::STANDARD.encode(py_script.as_bytes());
    let run_cmd = format!(
        "export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers && \
         export DISPLAY={display} && \
         mkdir -p /tmp && echo '{}' | base64 -d > /tmp/run_browser.py && \
         if ! python3 -c 'import socket; s = socket.socket(); s.connect((\"127.0.0.1\", 9222))' >/dev/null 2>&1; then \
             echo 'Starting headful chromium with remote debugging on DISPLAY={display}...' && \
             if command -v chromium >/dev/null 2>&1; then \
                 setsid nohup chromium --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-software-rasterizer >/tmp/headless_chrome.log 2>&1 & \
             elif command -v chromium-browser >/dev/null 2>&1; then \
                 setsid nohup chromium-browser --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-software-rasterizer >/tmp/headless_chrome.log 2>&1 & \
             elif command -v google-chrome >/dev/null 2>&1; then \
                 setsid nohup google-chrome --no-sandbox --remote-debugging-port=9222 --disable-gpu >/tmp/headless_chrome.log 2>&1 & \
             fi && \
             sleep 3; \
         fi; \
         if ! python3 -c 'import playwright' >/dev/null 2>&1; then \
             echo 'Installing playwright...' && \
             python3 -m pip install --break-system-packages playwright && \
             python3 -m playwright install chromium && \
             python3 -m playwright install-deps chromium; \
         fi; \
         python3 /tmp/run_browser.py",
        b64_script,
        display = DISPLAY_ID
    );


    let display_url = url.as_deref().unwrap_or("当前页面");
    crate::emit_info(&format!("正在沙盒中执行网页操作并渲染: {}...", display_url));
    let (stdout_stderr, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &run_cmd).await
        .map_err(|e| format!("浏览器工具执行出错: {}", e))?;

    if exit_code != 0 {
        let cleaned_output = clean_b64_from_output(&stdout_stderr);
        return Err(format!("沙箱浏览器执行失败: {}", cleaned_output));
    }

    // 3. 从 stdout 解析 Base64 图片数据并保存至本地
    let start_marker = "SCREENSHOT_B64_START";
    let end_marker = "SCREENSHOT_B64_END";
    let mut screenshot_saved = false;

    let mut screenshot_bytes: Option<Vec<u8>> = None;

    if let Some(start_idx) = stdout_stderr.find(start_marker) {
        if let Some(end_idx) = stdout_stderr.find(end_marker) {
            let b64_data = &stdout_stderr[start_idx + start_marker.len()..end_idx].trim();
            if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data) {
                screenshot_bytes = Some(img_bytes);
            }
        }
    }

    let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let ss_dir = base_dir.join(".flock/sandbox/screenshots").join(&session_id);
    let _ = std::fs::create_dir_all(&ss_dir);

    let ss_path = ss_dir.join(format!("{}.png", name_id));
    let ss_path_labeled = ss_dir.join(format!("{}_labeled.png", name_id));

    // 使用带红框标记的单图作为主输出，保证用户视觉和 AI 视觉完全对齐，性能最高
    if let Some(bytes) = screenshot_bytes {
        let _ = std::fs::write(&ss_path, &bytes);
        let _ = std::fs::write(base_dir.join(format!(".flock/sandbox/screenshot_{}.png", session_id)), &bytes);
        let _ = std::fs::write(&ss_path_labeled, &bytes);
        screenshot_saved = true;
        crate::emit_info("网页截图捕获完成：已保存红框标记图供给用户预览与大模型执行。");
    }

    // 提取标题信息
    let mut page_title = "未知网页".to_string();
    for line in stdout_stderr.lines() {
        if let Some(stripped) = line.strip_prefix("TITLE: ") {
            page_title = stripped.to_string();
        }
    }

    // 提取 DOM_TREE 信息
    let dom_start_marker = "DOM_TREE_START";
    let dom_end_marker = "DOM_TREE_END";
    let mut dom_tree_md = String::new();
    if let Some(start_idx) = stdout_stderr.find(dom_start_marker) {
        if let Some(end_idx) = stdout_stderr.find(dom_end_marker) {
            let tree_data = &stdout_stderr[start_idx + dom_start_marker.len()..end_idx].trim();
            if !tree_data.is_empty() {
                dom_tree_md = format!("\n\n### Interactive Elements (DOM Tree)\n```text\n{}\n```\n*Note: Use `click_id` / `fill_id` / `click_coord` with the extracted IDs or coordinates for precision.*", tree_data);
            }
        }
    }

    let abs_screenshot_path = base_dir.join(".flock/sandbox/screenshots").join(&session_id).join(format!("{}_labeled.png", name_id));
    let abs_path_str = abs_screenshot_path.to_string_lossy().to_string();

    let image_md = if screenshot_saved {
        format!("\n\n![网页截图](file:///{})", abs_path_str)
    } else {
        String::new()
    };

    let display_url = url.as_deref().unwrap_or("当前页面");
    Ok(format!(
        "已成功执行操作 [{}].\n当前网址: {}\n标题: {}{}{}",
        act, display_url, page_title, dom_tree_md, image_md
    ))
}

pub struct BrowserToolImpl;
impl BrowserToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(Browser, ToolCategory::Exec)
                .with_provider_id("sandbox")
                .with_provider_name("Sandbox"),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_b64_from_output() {
        let input = "Some warning SCREENSHOT_B64_START abcde SCREENSHOT_B64_END some trailing stuff";
        let output = clean_b64_from_output(input);
        assert!(output.contains("SCREENSHOT_B64_START"));
        assert!(output.contains("SCREENSHOT_B64_END"));
        assert!(output.contains("[截图二进制Base64数据已自动折叠]"));
        assert!(!output.contains("abcde"));
        assert!(output.contains("some trailing stuff"));
        assert!(output.contains("Some warning"));
        
        let input_no_end = "Some warning SCREENSHOT_B64_START abcde";
        let output_no_end = clean_b64_from_output(input_no_end);
        assert!(output_no_end.contains("SCREENSHOT_B64_START"));
        assert!(output_no_end.contains("[截图二进制Base64数据已自动折叠]"));
        assert!(!output_no_end.contains("abcde"));
    }
}

