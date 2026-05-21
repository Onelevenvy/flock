use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::{get_or_create_active_sandbox, execute_command_in_sandbox, start_computer_use_in_sandbox, check_computer_use_status};
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
        let proxy_url = format!("https://6080-{}.proxy.app.daytona.io", sandbox_id);
        
        crate::emit_info("正在向云端申请启动 Daytona 桌面服务 (noVNC)...");
        if let Err(e) = start_computer_use_in_sandbox(&db, &sandbox_id).await {
            crate::emit_info(&format!("启动 Daytona 桌面服务请求失败: {}。尝试备用手动方案...", e));
        }

        crate::emit_info("正在等待远程桌面服务启动就绪...");
        let mut desktop_ready = false;
        for i in 1..=20 {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            if let Ok(ready) = check_computer_use_status(&db, &sandbox_id).await {
                if ready {
                    desktop_ready = true;
                    crate::emit_info("远程桌面服务已就绪！");
                    break;
                }
            }
            if i % 3 == 0 {
                crate::emit_info(&format!("正在等待远程桌面启动 (已等待 {} 秒)...", i));
            }
        }

        if !desktop_ready {
            crate::emit_info("警告: 远程桌面未在预期时间内报告就绪状态，已强制连接。");
        }

        // 主动在 VNC 桌面的 DISPLAY :0 中启动浏览器访问指定的 URL
        crate::emit_info(&format!("正在远程桌面中打开网页: {}...", url));
        let launch_browser_cmd = format!(
            "sh -c 'export DISPLAY=:0 && chromium-browser --no-sandbox --disable-gpu --disable-software-rasterizer {} &'",
            url
        );
        
        let db_clone = db.clone();
        let sandbox_id_clone = sandbox_id.clone();
        tokio::spawn(async move {
            let _ = execute_command_in_sandbox(&db_clone, &sandbox_id_clone, &launch_browser_cmd).await;
        });

        let res_msg = format!(
            "人机协同远程桌面已拉起！您可以在右侧工作区预览区直接控制远程浏览器，或使用以下链接访问：\n\n[Remote VNC Link]({})\n",
            proxy_url
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

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    import subprocess
    print("Installing playwright...", file=sys.stderr)
    subprocess.run([sys.executable, "-m", "pip", "install", "playwright"])
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"])
    subprocess.run([sys.executable, "-m", "playwright", "install-deps", "chromium"])
    from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
    page = browser.new_page()
    
    # goto
    page.goto("{url}")
    
    action = "{act}"
    if action == "click" and "{sel_val}":
        page.click("{sel_val}")
        page.wait_for_timeout(1000)
    elif action == "fill" and "{sel_val}":
        page.fill("{sel_val}", "{text_val}")
        page.wait_for_timeout(1000)
        
    screenshot_bytes = page.screenshot()
    print("SCREENSHOT_B64_START")
    print(base64.b64encode(screenshot_bytes).decode('utf-8'))
    print("SCREENSHOT_B64_END")
    
    title = page.title()
    print(f"TITLE: {{title}}")
    browser.close()
"#,
        url = url,
        act = act,
        sel_val = sel_val.replace("\"", "\\\""),
        text_val = text_val.replace("\"", "\\\"")
    );

    let b64_script = general_purpose::STANDARD.encode(py_script.as_bytes());
    let run_cmd = format!(
        "mkdir -p /tmp && echo '{}' | base64 -d > /tmp/run_browser.py && python3 /tmp/run_browser.py",
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
