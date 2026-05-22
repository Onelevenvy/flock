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
/// Usage:
/// - Use this tool for GUI desktop automation (clicks, keyboard input, drag-and-drop) or direct shell command execution in the sandbox.
/// - **IMPORTANT**: For file system operations (mkdir, rm, ls, etc.), always prefer the `exec` action or the `CodeExecution` tool.
///   Example: `action="exec", command="mkdir /home/daytona/my_folder"` to create a directory.
/// - For GUI interactions, controls mouse/keyboard via xdotool and captures screenshots with scrot.
/// - Writes the screenshot to `.flock/sandbox/screenshot.png`.
///
/// Supported actions:
/// - `exec`      — Execute a shell command directly in the sandbox (RECOMMENDED for file/system operations).
/// - `click`     — Click mouse at (x, y). button: "left"|"right"|"middle".
/// - `move`      — Move mouse to (x, y).
/// - `drag`      — Drag from current position to (x, y).
/// - `scroll`    — Scroll mouse. button: "up"|"down".
/// - `type`      — Type text into focused input.
/// - `press`     — Press a key or hotkey (e.g. "Return", "ctrl+c").
/// - `screenshot`— Capture current desktop state.
/// - `status`    — Check desktop readiness.
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
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    // 2. 根据 action 决定是否需要启动 VNC 桌面
    let act = action.to_lowercase();

    // --- exec action: 直接在沙盒内执行 shell 命令，无需启动 VNC 桌面 ---
    if act == "exec" {
        let cmd = command.ok_or_else(|| "`exec` action 需要提供 `command` 参数。例如：command=\"mkdir /home/daytona/aaaaa\"".to_string())?;
        crate::emit_info(&format!("正在沙盒中执行命令: {}...", cmd));
        let (output, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
            .map_err(|e| format!("沙盒命令执行失败: {}", e))?;
        if exit_code == 0 {
            return Ok(format!("命令执行成功。\n\n[输出]\n{}", output));
        } else {
            return Err(format!("命令执行失败 (退出码: {})。\n\n[错误输出]\n{}", exit_code, output));
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
            let cmd = format!("export DISPLAY=:0 && xdotool mousemove {} {} click {}", px, py, click_btn);
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
            let cmd = format!("export DISPLAY=:0 && xdotool mousemove {} {}", px, py);
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
            let cmd = format!("export DISPLAY=:0 && xdotool mousedown 1 mousemove {} {} mouseup 1", px, py);
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
            let cmd = format!("export DISPLAY=:0 && xdotool click {}", scroll_btn);
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行鼠标滚动指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("鼠标滚动操作失败: {}", out));
            }
            result_msg = format!("成功执行了鼠标向上/下滚动 ({}) 操作。", btn);
        }
        "type" => {
            let t = text.ok_or_else(|| "键盘输入操作缺少必需的 'text' 参数。".to_string())?;
            let cmd = format!("export DISPLAY=:0 && xdotool type --delay 10 '{}'", t.replace("'", "'\\''"));
            let (out, code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
                .map_err(|e| format!("执行键盘输入指令失败: {}", e))?;
            if code != 0 {
                return Err(format!("键盘输入操作失败: {}", out));
            }
            result_msg = format!("成功向当前聚焦的文本框输入了内容: '{}'。", t);
        }
        "press" => {
            let k = key.ok_or_else(|| "键盘按键操作缺少必需的 'key' 参数。".to_string())?;
            let cmd = format!("export DISPLAY=:0 && xdotool key '{}'", k);
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

    // 4. 所有操作完成后，自动截取一张当前桌面的最新图片，并保存至 `.flock/sandbox/screenshot.png` 供前端渲染
    crate::emit_info("正在捕获当前远程桌面截图并渲染预览...");
    let ss_cmd = "export DISPLAY=:0 && scrot -o /tmp/desktop_screenshot.png && cat /tmp/desktop_screenshot.png | base64 -w 0";
    let (b64_data, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, ss_cmd).await
        .unwrap_or_default();

    if exit_code == 0 && !b64_data.is_empty() {
        if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data.trim()) {
            let ss_path = Path::new(".flock/sandbox/screenshot.png");
            if let Some(parent) = ss_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(ss_path, img_bytes);
            crate::emit_info("远程桌面最新状态已成功截取并拉回工作区预览！");
        }
    }

    let proxy_url = match crate::daytona::get_sandbox_vnc_url(&db, &sandbox_id).await {
        Ok(u) => u,
        Err(e) => {
            crate::emit_info(&format!("获取动态 VNC URL 失败: {}。使用静态备用 URL...", e));
            format!("https://6080-{}.proxy.app.daytona.io/vnc.html?autoconnect=true&resize=scale", sandbox_id)
        }
    };
    let final_res = format!(
        "{}\n\n当前桌面远程连接如下：\n\n[Remote VNC Link]({})\n\n💡 **重要安全提示**：由于云端代理没有内置您的局域网泛域名证书，若右侧预览窗口显示“空白”或“您的连接不是专用连接”报错，**请务必点击上方 [Remote VNC Link]({}) 链接**，在新开的标签页中点击 **“高级”** -> **“继续前往/忽略警告”** 授权信任，然后返回本界面刷新即可完美进行控制！",
        result_msg, proxy_url, proxy_url
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
