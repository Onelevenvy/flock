use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::{
    get_or_create_active_sandbox, execute_command_in_sandbox,
    start_computer_use_in_sandbox, check_computer_use_status, ensure_vnc_running_in_sandbox
};
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

/// A cloud-based GUI Computer Use tool for interacting with the sandbox desktop environment.
///
/// ## Core Features and Action Specification
/// - This tool is used to control the sandbox desktop GUI via simulated mouse/keyboard actions, execute shell scripts, and capture screenshots.
/// - **CLI/Command First**: For pure file-system or system administration operations (e.g., mkdir, rm, ls), always prefer using `action="exec"` (or the `CodeExecution` tool). It is significantly faster and more reliable than GUI simulation.
/// - Supported actions:
///   * `exec`      — Execute a shell command directly and asynchronously in the sandbox (Recommended for file/system operations).
///   * `click`     — Click the mouse at (x, y). `button` options: "left"|"right"|"middle".
///   * `move`      — Move the mouse cursor to (x, y).
///   * `drag`      — Hold left click and drag from the current position to (x, y).
///   * `scroll`    — Scroll the mouse wheel. `button` options: "up"|"down".
///   * `type`      — Type text into the currently focused input field (requires `text`).
///   * `press`     — Press a single key or key combination (e.g., "Return", "ctrl+c", requires `key`).
///   * `screenshot`— Capture the current OS desktop screen.
///   * `status`    — Query the readiness status of the desktop service.
///
/// IMPORTANT PATH RULES:
/// - The sandbox workspace is mounted at `/workspace` - all file operations should use this path
/// - Use relative paths like `file.txt` or `subdir/file.txt` (automatically mapped to `/workspace/...`)
/// - Or use absolute paths starting with `/workspace/` like `/workspace/file.txt`
/// - Do NOT use local machine paths like `/Users/...` or `C:\...` - they don't exist in the sandbox
/// - Files written to `/workspace` are automatically synced to local workspace for preview
///
/// ## 1. Visual Feedback Loop (Aligned with Manus / Top-tier AI Agents)
/// - **MANDATORY RULE**: After performing state-changing actions like `click`, `type`, or `press`, you must inspect the returned screen screenshot to verify the visual state.
/// - **Self-Correction & Fallback**: If you click the same coordinate 3 consecutive times but the screen or active window shows no change/response, **DO NOT blindly repeat the click**. You must immediately:
///   * Check if the window was shifted, closed, or obscured. Use `exec` with `xdotool search --onlyvisible --class [AppName]` to locate windows, or capture a full screenshot to recalibrate coordinates.
///   * If it is a web-based app, switch to the `Browser` tool to perform precise DOM manipulation instead.
///
/// ## 2. Proactive Collaboration & Risk Mitigation (Proactively Triggering Takeover)
/// - **Anti-Bot & Human Barrier Threshold**: If you see verifications on the desktop screen that require physical human interaction/devices:
///   * Slider captchas, puzzles, or facial verifications.
///   * SMS/Email passcodes requiring dynamic code lookup.
///   * Login QR codes requiring mobile app scanning (e.g., WeChat, Alipay).
///   * Bank/financial key fobs, physical security keys, or hardware authenticators.
/// - **Takeover Action Standard**: Once you detect these verification elements, **DO NOT** attempt to brute-force them via coordinate clicking. This will cause account suspension. You must immediately:
///   1. Stop all automated mouse/keyboard actions.
///   2. Tell the user using a warm, polite, and highly supportive tone:
///      "*I have launched the collaborative remote desktop for you. Since this application currently requires security verification/manual intervention, I have paused the automation. Please complete the verification in the VNC preview panel on the right, and let me know once you are done to resume.*"
///   3. Wait patiently for the user to complete the manual intervention via VNC.
///
/// ## 3. Manual Intervention Guide
/// - When the user explicitly requests manual control (e.g., "let me log in", "I want to do this myself", "open console", "manual input", "I'll take over"), reply warmly that the VNC desktop has been prepared on the right panel and wait for their manual actions to complete.
///
/// @param action The operation to perform (see above).
/// @param command Shell command to execute (required for `exec` action).
/// @param x Optional X coordinate for mouse actions.
/// @param y Optional Y coordinate for mouse actions.
/// @param button Optional mouse button or scroll direction.
/// @param text Optional text to type.
/// @param key Optional key or hotkey to press (e.g. "Return", "ctrl+c").
#[tool("ComputerUse")]
pub async fn computer_use(
    action: String,
    command: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
    button: Option<String>,
    text: Option<String>,
    key: Option<String>,
    call_id: Option<String>,
    msg_id: Option<String>,
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    let session_id = flock_core::get_current_session_id();

    // 生成唯一的截图标识
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let name_id = call_id.clone().unwrap_or_else(|| now_ms.to_string());

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    // 2. 根据 action 决定是否需要启动 VNC 桌面
    let act = action.to_lowercase();

    // --- exec action: 直接在沙盒内执行 shell 命令，无需启动 VNC 桌面 ---
    if act == "exec" {
        let cmd = command.ok_or_else(|| "`exec` action 需要提供 `command` 参数。例如：command=\"mkdir /workspace/my_project\"".to_string())?;
        crate::emit_info(&format!("正在沙盒中执行命令: {}...", cmd));
        let (output, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
            .map_err(|e| format!("沙盒命令执行失败: {}", e))?;

        // 智能动作帧捕获：检测当前是否有拉起 VNC 桌面的状态。
        // 如果有，则在命令完成后也自动截取一张桌面快照，使用户能在 VNC 时间轴上看到命令引起的 UI 变化！
        let mut image_md = String::new();
        if let Ok(ready) = check_computer_use_status(&db, &sandbox_id).await {
            if ready {
                let ss_cmd = format!("export DISPLAY={} && scrot -o /tmp/desktop_screenshot.png && cat /tmp/desktop_screenshot.png | base64 -w 0", crate::daytona::DISPLAY_ID);
                if let Ok((b64_data, exit_code)) = execute_command_in_sandbox(&db, &sandbox_id, &ss_cmd).await {
                    if exit_code == 0 && !b64_data.is_empty() {
                        if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data.trim()) {
                            let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
                            let ss_dir = base_dir.join(".flock/sandbox/screenshots").join(&session_id);
                            let ss_path = ss_dir.join(format!("{}.png", name_id));
                            let _ = std::fs::create_dir_all(&ss_dir);
                            let _ = std::fs::write(&ss_path, &img_bytes);
                            let _ = std::fs::write(base_dir.join(format!(".flock/sandbox/screenshot_{}.png", session_id)), &img_bytes);
                            
                            let abs_path_str = ss_path.to_string_lossy().to_string();
                            image_md = format!("\n\n![桌面截图](file:///{})", abs_path_str);
                        }
                    }
                }
            }
        }

        if exit_code == 0 {
            return Ok(format!("命令执行成功。\n\n[输出]\n{}{}", output, image_md));
        } else {
            return Err(format!("命令执行失败 (退出码: {})。\n\n[错误输出]\n{}{}", exit_code, output, image_md));
        }
    }

    // 3. 非 exec 操作需要确保 VNC 桌面环境已就绪
    let mut desktop_ready = false;
    if let Ok(ready) = check_computer_use_status(&db, &sandbox_id).await {
        if ready {
            desktop_ready = true;
        }
    }

    if !desktop_ready {
        crate::emit_info("检测到 VNC 桌面服务尚未启动，正在向云端拉起桌面服务...");
        if let Err(e) = start_computer_use_in_sandbox(&db, &sandbox_id).await {
            crate::emit_info(&format!("启动 Daytona 桌面服务请求失败: {}。尝试备用手动方案...", e));
        }

        // 调用统一的自愈拉起函数，确保 Xvfb, fluxbox, x11vnc, websockify 在 0.0.0.0 运行且 setsid 保活
        let _ = ensure_vnc_running_in_sandbox(&db, &sandbox_id).await;

        crate::emit_info("正在等待远程桌面服务就绪...");
        for i in 1..=15 {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            if let Ok(ready) = check_computer_use_status(&db, &sandbox_id).await {
                if ready {
                    desktop_ready = true;
                    crate::emit_info("远程桌面服务已就绪！");
                    break;
                }
            }
        }

        if !desktop_ready {
            crate::emit_info("警告: 远程桌面未报告就绪状态，继续尝试执行任务。");
        }
    }

    // 确保 xdotool 和 scrot 已安装
    let setup_cmd = "sh -c 'if ! command -v xdotool >/dev/null || ! command -v scrot >/dev/null; then sudo apt-get update && sudo apt-get install -y xdotool scrot; fi'";
    let _ = execute_command_in_sandbox(&db, &sandbox_id, setup_cmd).await;

    let mut result_msg = String::new();

    match act.as_str() {
        "status" => {
            result_msg = "Daytona 桌面环境已启动且处于活跃就绪状态。".to_string();
        }
        "click" => {
            let px = x.unwrap_or(0);
            let py = y.unwrap_or(0);
            let btn = button.unwrap_or_else(|| "left".to_string());
            let click_btn = match btn.as_str() {
                "right" => "3",
                "middle" => "2",
                _ => "1",
            };
            let cmd = format!("export DISPLAY={} && xdotool mousemove {} {} click {}", crate::daytona::DISPLAY_ID, px, py, click_btn);
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行鼠标点击指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("鼠标点击操作失败: {}", out));
            }
            result_msg = format!("成功在 ({}, {}) 处执行了鼠标 {} 键点击操作。", px, py, btn);
        }
        "move" => {
            let px = x.unwrap_or(0);
            let py = y.unwrap_or(0);
            let cmd = format!("export DISPLAY={} && xdotool mousemove {} {}", crate::daytona::DISPLAY_ID, px, py);
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行鼠标移动指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("鼠标移动操作失败: {}", out));
            }
            result_msg = format!("成功将鼠标移动至坐标 ({}, {})。", px, py);
        }
        "drag" => {
            let px = x.unwrap_or(0);
            let py = y.unwrap_or(0);
            let cmd = format!("export DISPLAY={} && xdotool mousedown 1 mousemove {} {} mouseup 1", crate::daytona::DISPLAY_ID, px, py);
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行鼠标拖拽指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("鼠标拖拽操作失败: {}", out));
            }
            result_msg = format!("成功将元素拖拽移动至坐标 ({}, {})。", px, py);
        }
        "scroll" => {
            let btn = button.unwrap_or_else(|| "down".to_string());
            let scroll_btn = match btn.as_str() {
                "up" => "4",
                _ => "5", // down
            };
            let cmd = format!("export DISPLAY={} && xdotool click {}", crate::daytona::DISPLAY_ID, scroll_btn);
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行鼠标滚动指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("鼠标滚动操作失败: {}", out));
            }
            result_msg = format!("成功执行了鼠标向上/下滚动 ({}) 操作。", btn);
        }
        "type" => {
            let t = text.ok_or_else(|| "键盘输入操作缺少必需的 'text' 参数。".to_string())?;
            let cmd = format!("export DISPLAY={} && xdotool type --delay 10 '{}'", crate::daytona::DISPLAY_ID, t.replace("'", "'\\''"));
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行键盘输入指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("键盘输入操作失败: {}", out));
            }
            result_msg = format!("成功向当前聚焦的文本框输入了内容: '{}'。", t);
        }
        "press" => {
            let k = key.ok_or_else(|| "键盘按键操作缺少必需的 'key' 参数。".to_string())?;
            let cmd = format!("export DISPLAY={} && xdotool key '{}'", crate::daytona::DISPLAY_ID, k);
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行键盘按键指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("键盘按键操作失败: {}", out));
            }
            result_msg = format!("成功触发了按键指令: '{}'。", k);
        }
        "screenshot" => {
            result_msg = "已请求截取屏幕当前状态。".to_string();
        }
        _ => {
            return Err(format!("不支持的 ComputerUse 操作类型: '{}'。", act));
        }
    }

    // 4. 所有操作完成后，自动截取一张当前桌面的最新图片，并保存至 `.flock/sandbox/screenshots/{name_id}.png` 供前端渲染
    crate::emit_info("正在捕获当前远程桌面截图并渲染预览...");
    let ss_cmd = format!("export DISPLAY={} && scrot -o /tmp/desktop_screenshot.png && cat /tmp/desktop_screenshot.png | base64 -w 0", crate::daytona::DISPLAY_ID);
    let (b64_data, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &ss_cmd).await
        .unwrap_or_default();

    let mut screenshot_saved = false;
    if exit_code == 0 && !b64_data.is_empty() {
        if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data.trim()) {
            let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
            let ss_dir = base_dir.join(".flock/sandbox/screenshots").join(&session_id);
            let ss_path = ss_dir.join(format!("{}.png", name_id));
            if let Some(parent) = ss_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&ss_path, &img_bytes);
            let _ = std::fs::write(base_dir.join(format!(".flock/sandbox/screenshot_{}.png", session_id)), &img_bytes);
            screenshot_saved = true;
            crate::emit_info("远程桌面最新状态已成功截取并拉回工作区预览！");
        }
    }

    let proxy_url = match crate::daytona::get_sandbox_vnc_url(&db, &sandbox_id).await {
        Ok(u) => u,
        Err(e) => {
            crate::emit_info(&format!("获取动态 VNC URL 失败: {}。使用静态备用 URL...", e));
            format!("https://{}-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", crate::daytona::WEBSOCKIFY_PORT, sandbox_id)
        }
    };

    let base_dir = crate::get_workspace_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let abs_screenshot_path = base_dir.join(".flock/sandbox/screenshots").join(&session_id).join(format!("{}.png", name_id));
    let abs_path_str = abs_screenshot_path.to_string_lossy().to_string();

    let image_md = if screenshot_saved {
        format!("\n\n![桌面截图](file:///{})", abs_path_str)
    } else {
        String::new()
    };

    let final_res = format!(
        "{}\n\n当前桌面远程连接如下：\n\n[Remote VNC Link]({})\n\n💡 **重要安全提示**：由于云端代理没有内置您的局域网泛域名证书，若右侧预览窗口显示“空白”或“您的连接不是专用连接”报错，**请务必点击上方 [Remote VNC Link]({}) 链接**，在新开的标签页中点击 **“高级”** -> **“继续前往/忽略警告”** 授权信任，然后返回本界面刷新即可完美进行控制！{}",
        result_msg, proxy_url, proxy_url, image_md
    );

    Ok(final_res)
}

pub struct ComputerUseToolImpl;
impl ComputerUseToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(ComputerUse, ToolCategory::Exec)
                .with_provider_id("sandbox")
                .with_provider_name("Sandbox"),
        )
    }
}
