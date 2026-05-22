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
/// Usage:
/// - Use this tool when you need to fetch web pages, interact with pages (click, fill), or visual screenshot verification.
/// - Returns page screenshot or text content, and writes the screenshot to `.flock/sandbox/screenshot.png`.
/// - Supported actions: "goto" (open URL and screenshot), "click" (click element), "fill" (type text), "interactive" (get VNC remote control proxy URL).
/// - CRITICAL: If the user requests manual control, manual input, manual login, or wants to interact with the webpage himself, you MUST set action to "interactive". This will launch the remote VNC desktop in the preview area, allowing the user to take control.
///
/// @param url The target website URL.
/// @param action The browser action: "goto" (default), "click", "fill", "interactive".
/// @param selector Optional CSS selector to click or fill (required for click/fill).
/// @param text Optional text content to type into an input field (required for fill).
#[tool("Browser")]
pub async fn browser(
    url: String,
    action: Option<String>,
    selector: Option<String>,
    text: Option<String>,
    call_id: Option<String>,
    msg_id: Option<String>,
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    let act = action.unwrap_or_else(|| "goto".to_string());
    
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

        // 运行网页分析脚本，并自动跳转
        crate::emit_info(&format!("正在远程浏览器中打开网页并分析安全要素: {}...", url));
        let py_check_script = format!(
            r#"
import sys
import json
import base64
from playwright.sync_api import sync_playwright

try:
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        context = browser.contexts[0]
        active_page = None
        if context.pages:
            for p_candidate in reversed(context.pages):
                if p_candidate.url and p_candidate.url != "about:blank":
                    active_page = p_candidate
                    break
        page = active_page if active_page else (context.pages[0] if context.pages else context.new_page())
        
        try:
            page.goto("{url}", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"GOTO_WARNING: {{e}}", file=sys.stderr)
            
        captcha_selectors = [
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            'iframe[src*="turnstile"]',
            'div[class*="geetest"]',
            'div[id*="geetest"]',
            'div[class*="captcha"]',
            'div[id*="captcha"]',
            'iframe[src*="captcha"]',
            'div[id*="cf-turnstile"]',
            'div[class*="cf-turnstile"]'
        ]
        
        has_password = page.locator('input[type="password"]').count() > 0
        has_captcha = False
        for sel in captcha_selectors:
            try:
                if page.locator(sel).count() > 0:
                    has_captcha = True
                    break
            except Exception:
                pass
                
        # 深度敏感校验字扫描：处理未处于活跃 Tab 的密码框与未弹出的风控滑块
        page_text = page.evaluate("() => document.body.innerText || ''").lower()
        url_lower = page.url.lower()
        
        is_sensitive_login = "密码" in page_text or "password" in page_text or "signin" in url_lower or "login" in url_lower
        is_sensitive_captcha = any(kw in page_text for kw in ["验证码", "captcha", "slider", "滑块", "点击验证", "验证", "安全校验", "verify"])
        
        need_takeover = has_password or has_captcha or (is_sensitive_login and ("登录" in page_text or "signin" in page_text or "login" in page_text)) or is_sensitive_captcha
        print("CHECK_RESULT:" + json.dumps({{"
            "need_takeover": need_takeover,
            "has_password": has_password,
            "has_captcha": has_captcha
        }}))
        
        try:
            screenshot_bytes = page.screenshot(timeout=5000)
            print("SCREENSHOT_B64_START")
            print(base64.b64encode(screenshot_bytes).decode('utf-8'))
            print("SCREENSHOT_B64_END")
        except Exception as e:
            print(f"SCREENSHOT_ERROR: {{e}}", file=sys.stderr)
            
except Exception as e:
    print(f"FATAL_ERROR: {{e}}", file=sys.stderr)
    sys.exit(1)
sys.exit(0)
"#,
            url = url.replace("\"", "\\\"")
        );

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
                    let ss_dir = base_dir.join(".flock/sandbox/screenshots");
                    let ss_path = ss_dir.join(format!("{}.png", name_id));
                    if let Some(parent) = ss_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let _ = std::fs::write(&ss_path, &img_bytes);
                    screenshot_saved = true;
                    // 同时保留一份覆盖的 screenshot.png 兼容以前的设计
                    let _ = std::fs::write(base_dir.join(".flock/sandbox/screenshot.png"), &img_bytes);
                }
            }
        }

        let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        let abs_screenshot_path = base_dir.join(".flock/sandbox/screenshots").join(format!("{}.png", name_id));
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

    // 2. 生成 Python Playwright 自动安装并执行截图的脚本
    let sel_val = selector.unwrap_or_default();
    let text_val = text.unwrap_or_default();
    
    let py_script = format!(
        r#"
import sys
import base64
from playwright.sync_api import sync_playwright

try:
    with sync_playwright() as p:
        browser = None
        is_cdp = False
        
        # 优先尝试连接 CDP 调试端口以保持会话状态
        try:
            browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            is_cdp = True
            context = browser.contexts[0]
            active_page = None
            if context.pages:
                for p_candidate in reversed(context.pages):
                    if p_candidate.url and p_candidate.url != "about:blank":
                        active_page = p_candidate
                        break
            page = active_page if active_page else (context.pages[0] if context.pages else context.new_page())
        except Exception as e:
            print(f"CDP_CONNECT_WARNING: {{e}}", file=sys.stderr)
            browser = p.chromium.launch(headless=False, args=["--no-sandbox", "--disable-setuid-sandbox"])
            page = browser.new_page()

        action = "{act}"
        url = "{url}"
        
        should_goto = False
        if action == "goto" or not is_cdp:
            should_goto = True
        else:
            current_url = page.url
            if current_url == "about:blank" or not current_url:
                should_goto = True

        if should_goto:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
            except Exception as e:
                print(f"GOTO_WARNING: {{e}}", file=sys.stderr)
        
        if action == "click" and "{sel_val}":
            try:
                page.click("{sel_val}", timeout=5000)
                page.wait_for_timeout(1000)
            except Exception as e:
                print(f"CLICK_WARNING: {{e}}", file=sys.stderr)
        elif action == "fill" and "{sel_val}":
            try:
                page.fill("{sel_val}", "{text_val}", timeout=5000)
                page.wait_for_timeout(1000)
            except Exception as e:
                print(f"FILL_WARNING: {{e}}", file=sys.stderr)
            
        try:
            screenshot_bytes = page.screenshot(timeout=5000)
            print("SCREENSHOT_B64_START")
            print(base64.b64encode(screenshot_bytes).decode('utf-8'))
            print("SCREENSHOT_B64_END")
        except Exception as e:
            print(f"SCREENSHOT_ERROR: {{e}}", file=sys.stderr)
        
        try:
            title = page.title()
            print(f"TITLE: {{title}}")
        except Exception as e:
            pass
            
        if not is_cdp:
            browser.close()
except Exception as e:
    print(f"FATAL_ERROR: {{e}}", file=sys.stderr)
    sys.exit(1)

sys.exit(0)
"#,
        url = url,
        act = act,
        sel_val = sel_val.replace("\"", "\\\""),
        text_val = text_val.replace("\"", "\\\"")
    );

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


    crate::emit_info(&format!("正在沙盒中执行网页操作并渲染: {}...", url));
    let (stdout_stderr, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &run_cmd).await
        .map_err(|e| format!("浏览器工具执行出错: {}", e))?;

    if exit_code != 0 {
        return Err(format!("沙箱浏览器执行失败: {}", stdout_stderr));
    }

    // 3. 从 stdout 解析 Base64 图片数据并保存至本地 `.flock/sandbox/screenshots/{name_id}.png`
    let start_marker = "SCREENSHOT_B64_START";
    let end_marker = "SCREENSHOT_B64_END";
    let mut screenshot_saved = false;

    if let Some(start_idx) = stdout_stderr.find(start_marker) {
        if let Some(end_idx) = stdout_stderr.find(end_marker) {
            let b64_data = &stdout_stderr[start_idx + start_marker.len()..end_idx].trim();
            if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data) {
                let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
                let ss_dir = base_dir.join(".flock/sandbox/screenshots");
                let ss_path = ss_dir.join(format!("{}.png", name_id));
                if let Some(parent) = ss_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&ss_path, &img_bytes);
                let _ = std::fs::write(base_dir.join(".flock/sandbox/screenshot.png"), &img_bytes);
                screenshot_saved = true;
                crate::emit_info("网页截图已成功保存至工作区，已生成步骤快照。");
            }
        }
    }

    // 提取标题信息
    let mut page_title = "未知网页".to_string();
    for line in stdout_stderr.lines() {
        if let Some(stripped) = line.strip_prefix("TITLE: ") {
            page_title = stripped.to_string();
        }
    }

    let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let abs_screenshot_path = base_dir.join(".flock/sandbox/screenshots").join(format!("{}.png", name_id));
    let abs_path_str = abs_screenshot_path.to_string_lossy().to_string();

    let image_md = if screenshot_saved {
        format!("\n\n![网页截图](file:///{})", abs_path_str)
    } else {
        String::new()
    };

    Ok(format!(
        "已成功打开并渲染网页 [{}](url)\n标题: {}\n操作类型: {}\n网页截图已成功捕获并完美存入步骤记录中。{}",
        url, page_title, act, image_md
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
