mod helpers;
mod interactive;

use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::sandbox_core::manager::{get_or_create_active_sandbox, execute_command_in_sandbox, ensure_vnc_running_in_sandbox};
use crate::sandbox_core::daytona::DISPLAY_ID;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;
use base64::{Engine as _, engine::general_purpose};

use helpers::{clean_b64_from_output, extract_and_save_screenshot, extract_page_title, extract_dom_tree, screenshot_image_md};

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

    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    let mut act = action.unwrap_or_else(|| "goto".to_string()).to_lowercase();
    if act == "open" || act == "navigate" {
        act = "goto".to_string();
    }

    // Auto-correct action based on provided parameters
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

    if (act == "goto" || act == "interactive") && url.is_none() {
        return Err("执行 goto 或 interactive 操作时，必须提供 url 参数。".to_string());
    }

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let name_id = call_id.clone().unwrap_or_else(|| now_ms.to_string());

    // Delegate interactive mode to its dedicated handler
    if act == "interactive" {
        return interactive::handle_interactive(
            &db,
            &sandbox_id,
            &session_id,
            &name_id,
            url.as_deref().unwrap_or_default(),
            call_id,
            msg_id,
        )
        .await;
    }

    // Regular browser actions via Playwright script
    execute_regular_action(&db, &sandbox_id, &session_id, &name_id, &act, url, selector, text, element_id, x, y, key).await
}

async fn execute_regular_action(
    db: &flock_core::db::DbManager,
    sandbox_id: &str,
    session_id: &str,
    name_id: &str,
    act: &str,
    url: Option<String>,
    selector: Option<String>,
    text: Option<String>,
    element_id: Option<i32>,
    x: Option<i32>,
    y: Option<i32>,
    key: Option<String>,
) -> Result<String, String> {
    let py_script_template = include_str!("../scripts/browser_actions.py");
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

    let _ = ensure_vnc_running_in_sandbox(db, sandbox_id).await;

    let b64_script = general_purpose::STANDARD.encode(py_script.as_bytes());
    let run_cmd = format!(
        "export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers && \
         export DISPLAY={display} && \
         mkdir -p /tmp && echo '{}' | base64 -d > /tmp/run_browser.py && \
         if python3 -c 'import socket; s = socket.socket(); s.connect((\"127.0.0.1\", 9222))' >/dev/null 2>&1; then \
             if ps aux 2>/dev/null | grep -v grep | grep -q 'disable-software-rasterizer'; then \
                 echo 'Detected old chromium with --disable-software-rasterizer, restarting with correct flags...' && \
                 pkill -f 'remote-debugging-port=9222' 2>/dev/null; sleep 1; \
             fi; \
         fi; \
         if ! python3 -c 'import socket; s = socket.socket(); s.connect((\"127.0.0.1\", 9222))' >/dev/null 2>&1; then \
             echo 'Starting headful chromium with remote debugging on DISPLAY={display}...' && \
             if command -v chromium >/dev/null 2>&1; then \
                 setsid nohup env DISPLAY={display} chromium --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --window-size=1280,1024 >/tmp/headless_chrome.log 2>&1 & \
             elif command -v chromium-browser >/dev/null 2>&1; then \
                 setsid nohup env DISPLAY={display} chromium-browser --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --window-size=1280,1024 >/tmp/headless_chrome.log 2>&1 & \
             elif command -v google-chrome >/dev/null 2>&1; then \
                 setsid nohup env DISPLAY={display} google-chrome --no-sandbox --remote-debugging-port=9222 --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check --window-size=1280,1024 >/tmp/headless_chrome.log 2>&1 & \
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

    let (stdout_stderr, exit_code) = execute_command_in_sandbox(db, sandbox_id, &run_cmd)
        .await
        .map_err(|e| format!("浏览器工具执行出错: {}", e))?;

    if exit_code != 0 {
        let cleaned_output = clean_b64_from_output(&stdout_stderr);
        return Err(format!("沙箱浏览器执行失败: {}", cleaned_output));
    }

    let (screenshot_path, screenshot_saved) =
        extract_and_save_screenshot(&stdout_stderr, session_id, name_id, "_labeled");
    let page_title = extract_page_title(&stdout_stderr);
    let dom_tree_md = extract_dom_tree(&stdout_stderr);
    let image_md = screenshot_image_md(&screenshot_path);

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
