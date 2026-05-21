use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::{get_or_create_active_sandbox, execute_command_in_sandbox, start_computer_use_in_sandbox, check_computer_use_status, ensure_vnc_running_in_sandbox};
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
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    let act = action.unwrap_or_else(|| "goto".to_string());
    
    // 如果是 interactive 人工接管模式，我们直接返回远程桌面的 noVNC 代理链接，让前端渲染
    if act == "interactive" {
        let proxy_url = match crate::daytona::get_sandbox_vnc_url(&db, &sandbox_id).await {
            Ok(u) => u,
            Err(e) => {
                crate::emit_info(&format!("获取动态 VNC URL 失败: {}。使用静态备用 URL...", e));
                format!("https://6080-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", sandbox_id)
            }
        };
        
        crate::emit_info("正在向云端申请启动 Daytona 桌面服务 (noVNC)...");
        if let Err(e) = start_computer_use_in_sandbox(&db, &sandbox_id).await {
            crate::emit_info(&format!("启动 Daytona 桌面服务请求失败: {}。尝试备用手动方案...", e));
        }

        // 调用统一的自愈拉起函数，确保 Xvfb, fluxbox, x11vnc, websockify 在 0.0.0.0 运行且 setsid 保活
        let _ = ensure_vnc_running_in_sandbox(&db, &sandbox_id).await;

        // 主动在 VNC 桌面的 DISPLAY :0 中启动浏览器访问指定的 URL
        crate::emit_info(&format!("正在远程桌面中打开网页: {}...", url));
        let launch_browser_cmd = format!(
            "sh -c '\
             export DISPLAY=:0 && \
             if command -v chromium >/dev/null 2>&1; then \
                 setsid nohup chromium --no-sandbox --disable-gpu --disable-software-rasterizer \"{url}\" >/tmp/chromium.log 2>&1 & \
             elif command -v chromium-browser >/dev/null 2>&1; then \
                 setsid nohup chromium-browser --no-sandbox --disable-gpu --disable-software-rasterizer \"{url}\" >/tmp/chromium.log 2>&1 & \
             elif command -v google-chrome >/dev/null 2>&1; then \
                 setsid nohup google-chrome --no-sandbox --disable-gpu \"{url}\" >/tmp/chromium.log 2>&1 & \
             fi'",
            url = url.replace("'", "'\\''")
        );
        
        let db_clone = db.clone();
        let sandbox_id_clone = sandbox_id.clone();
        tokio::spawn(async move {
            let _ = execute_command_in_sandbox(&db_clone, &sandbox_id_clone, &launch_browser_cmd).await;
        });

        let res_msg = format!(
            "人机协同远程桌面已拉起！您可以在右侧工作区预览区直接控制远程浏览器，或使用以下链接访问：\n\n[Remote VNC Link]({})\n\n💡 **重要安全提示**：由于云端代理没有内置您的局域网泛域名证书，若右侧预览窗口显示“空白”或“您的连接不是专用连接”报错，**请务必点击上方 [Remote VNC Link]({}) 链接**，在新开的标签页中点击 **“高级”** -> **“继续前往/忽略警告”** 授权信任，然后返回本界面刷新即可完美进行控制！",
            proxy_url, proxy_url
        );
        return Ok(res_msg);
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
            page = context.pages[0] if context.pages else context.new_page()
        except Exception as e:
            print(f"CDP_CONNECT_WARNING: {{e}}", file=sys.stderr)
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
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

    let b64_script = general_purpose::STANDARD.encode(py_script.as_bytes());
    let run_cmd = format!(
        "export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers && \
         mkdir -p /tmp && echo '{}' | base64 -d > /tmp/run_browser.py && \
         if ! python3 -c 'import socket; s = socket.socket(); s.connect((\"127.0.0.1\", 9222))' >/dev/null 2>&1; then \
             echo 'Starting headless chromium with remote debugging...' && \
             if command -v chromium >/dev/null 2>&1; then \
                 setsid nohup chromium --no-sandbox --remote-debugging-port=9222 --headless=new --disable-gpu --disable-software-rasterizer >/tmp/headless_chrome.log 2>&1 & \
             elif command -v chromium-browser >/dev/null 2>&1; then \
                 setsid nohup chromium-browser --no-sandbox --remote-debugging-port=9222 --headless=new --disable-gpu --disable-software-rasterizer >/tmp/headless_chrome.log 2>&1 & \
             elif command -v google-chrome >/dev/null 2>&1; then \
                 setsid nohup google-chrome --no-sandbox --remote-debugging-port=9222 --headless=new --disable-gpu >/tmp/headless_chrome.log 2>&1 & \
             fi && \
             sleep 2; \
         fi; \
         if ! python3 -c 'import playwright' >/dev/null 2>&1; then \
             echo 'Installing playwright...' && \
             python3 -m pip install --break-system-packages playwright && \
             python3 -m playwright install chromium && \
             python3 -m playwright install-deps chromium; \
         fi; \
         python3 /tmp/run_browser.py",
        b64_script
    );


    crate::emit_info(&format!("正在沙盒中执行网页操作并渲染: {}...", url));
    let (stdout_stderr, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &run_cmd).await
        .map_err(|e| format!("浏览器工具执行出错: {}", e))?;

    if exit_code != 0 {
        return Err(format!("沙箱浏览器执行失败: {}", stdout_stderr));
    }

    // 3. 从 stdout 解析 Base64 图片数据并保存至本地 `.flock/sandbox/screenshot.png`
    let start_marker = "SCREENSHOT_B64_START";
    let end_marker = "SCREENSHOT_B64_END";

    if let Some(start_idx) = stdout_stderr.find(start_marker) {
        if let Some(end_idx) = stdout_stderr.find(end_marker) {
            let b64_data = &stdout_stderr[start_idx + start_marker.len()..end_idx].trim();
            if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data) {
                let ss_path = Path::new(".flock/sandbox/screenshot.png");
                if let Some(parent) = ss_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(ss_path, img_bytes);
                crate::emit_info("网页截图已成功保存至工作区，正在渲染预览...");
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

    // 后台异步启动 VNC 服务（不阻塞主流程），使 noVNC 标签可正常连接
    {
        let db_bg = db.clone();
        let sb_bg = sandbox_id.clone();
        tokio::spawn(async move {
            let _ = ensure_vnc_running_in_sandbox(&db_bg, &sb_bg).await;
        });
    }

    Ok(format!(
        "已成功打开并渲染网页 [{}](url)\n标题: {}\n操作类型: {}\n网页截图已拉回至工作区并显示在右侧预览区。",
        url, page_title, act
    ))
}

pub struct BrowserToolImpl;
impl BrowserToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Browser, ToolCategory::Exec))
    }
}
