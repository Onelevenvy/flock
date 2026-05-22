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
/// ## 核心能力与动作规范
/// - 本工具用于控制沙盒内的操作系统桌面 GUI 键鼠、执行 Shell 脚本以及截屏。
/// - **命令优先**：对于纯文件系统和环境管理（如 mkdir, rm, ls 等），请始终优先使用 `action="exec"`（或者直接调用 `CodeExecution` 工具），比 GUI 模拟要快速、准确得多。
/// - **支持动作 (action)**：
///   * `exec`      — 直接在沙盒中异步运行 Shell 命令（推荐）。
///   * `click`     — 点击屏幕坐标 (x, y)。`button`可选："left"|"right"|"middle"。
///   * `move`      — 移动鼠标至坐标 (x, y)。
///   * `drag`      — 按住左键从当前位置拖拽到 (x, y)。
///   * `scroll`    — 鼠标滚轮滚动。`button`可选："up"|"down"。
///   * `type`      — 键盘录入文本至当前聚焦的输入框（提供 `text` 参数）。
///   * `press`     — 触发键盘单键或快捷键（如 "Return"、"ctrl+c"等，提供 `key` 参数）。
///   * `screenshot`— 获取当前操作系统的 GUI 屏幕截图。
///   * `status`    — 获取当前桌面服务的就绪状态。
///
/// ## 1. 视觉自检与反馈闭环（Visual Feedback Loop - 对齐 Manus 等顶级架构）
/// - **强制规范**：在使用 `click`, `type`, `press` 等动作修改桌面状态后，系统会自动捕获新屏幕状态截图并将其追加。您必须随时利用这些返回的截图核实状态。
/// - **自检纠错**：如果您发现点击页面某坐标或按钮 3 次后，屏幕或窗口依然无变化、或应用无响应，**严禁盲目继续用相同坐标重试**。这通常是因为：
///   * 屏幕分辨率偏差、窗口发生了位移、或目标被遮挡。
///   * 您应该先使用 `exec` 执行 `xdotool search --onlyvisible --class [AppName]` 探测窗口具体坐标，或者截取大图进行精确定位修正。
///   * 也可以改用 `Browser` 工具（如果是网页操作）直接对 DOM 元素进行操纵，减少坐标偏差。
///
/// ## 2. 人机协作前置提示词与临界主动让贤（Proactive Collaboration - 主动触发接管）
/// - **风控与强人机壁垒状态**：如果您在操纵桌面应用时，屏幕上弹出了：
///   * 安全风控滑块验证、极验、人脸扫码。
///   * 邮箱/手机验证码、动态短信验证。
///   * 要求用户手动扫微信/支付宝/APP二维码登录。
///   * 要求用户使用实物 U 盾或保密卡等大模型完全无法触及的硬件验证设备。
/// - **主动让贤规范**：一旦在最新截图中看到这类需要物理人手/设备介入的验证要素，**严禁**继续进行后台尝试，这会直接招致账号风控封禁。您必须立即执行以下人机协同交接：
///   1. 立即停止任何自动键鼠动作。
///   2. 使用**温和诚恳、极具亲和力且情绪价值拉满的语气**对用户说：
///      “*我已经帮您拉起了协同远程桌面。检测到该应用当前需要进行安全人身验证/滑块扫码，我已自动暂停，请您在右侧预览区进行控制操作，完成后告知我以恢复。*”
///   3. 提示用户后，用户会通过右侧的 noVNC 直接接管，操作完成后点击“我已完成操作”，Agent 将无缝从暂停点继续运转。
///
/// ## 3. 用户手动接管指示
/// - 当用户发出“让我来操作”、“打开控制台”、“手动输入”、“我来控制”、“换我来吧”等指令时，请明确回复用户“*已经为您在右侧面板准备好了桌面 VNC，请直接进行操作控制*”，并温和等待用户的操作指令。
///
/// @param action The operation to perform (see above).
/// @param command Shell command to execute (required for `exec` action).
/// @param x Optional X coordinate for mouse actions.
/// @param y Optional Y coordinate for mouse actions.
/// @param button Optional mouse button or scroll direction.
/// @param text Optional text to type.
/// @param key Optional key or hotkey to press (e.g. "Return", "ctrl+c").
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
            let ss_dir = base_dir.join(".flock/sandbox/screenshots");
            let ss_path = ss_dir.join(format!("{}.png", name_id));
            if let Some(parent) = ss_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&ss_path, &img_bytes);
            let _ = std::fs::write(base_dir.join(".flock/sandbox/screenshot.png"), &img_bytes);
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
    let abs_screenshot_path = base_dir.join(".flock/sandbox/screenshots").join(format!("{}.png", name_id));
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
