use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::sandbox_manager::{get_or_create_active_sandbox, execute_command_in_sandbox, get_sandbox_vnc_url};
use crate::daytona::{
    start_computer_use_in_sandbox, check_computer_use_status, ensure_vnc_running_in_sandbox,
    DISPLAY_ID,
};
use flock_core::db::DbManager;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;
use base64::{Engine as _, engine::general_purpose};

/// Execute an xdotool command in the sandbox desktop environment.
async fn run_xdotool(
    db: &DbManager,
    sandbox_id: &str,
    xdotool_args: &str,
    action_name: &str,
) -> Result<(), String> {
    let cmd = format!("export DISPLAY={} && xdotool {}", DISPLAY_ID, xdotool_args);
    let (out, code) = execute_command_in_sandbox(db, sandbox_id, &cmd)
        .await
        .map_err(|e| format!("执行{}指令失败: {}", action_name, e))?;
    if code != 0 {
        return Err(format!("{}操作失败: {}", action_name, out));
    }
    Ok(())
}

/// Capture a desktop screenshot and save it to the workspace.
/// Returns (image_markdown, screenshot_saved).
async fn capture_desktop_screenshot(
    db: &DbManager,
    sandbox_id: &str,
    session_id: &str,
    name_id: &str,
) -> (String, bool) {
    let ss_cmd = format!(
        "export DISPLAY={} && scrot -o /tmp/desktop_screenshot.png && cat /tmp/desktop_screenshot.png | base64 -w 0",
        DISPLAY_ID
    );
    let (b64_data, exit_code) = execute_command_in_sandbox(db, sandbox_id, &ss_cmd)
        .await
        .unwrap_or_default();

    if exit_code == 0 && !b64_data.is_empty() {
        if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data.trim()) {
            let base_dir = crate::get_workspace_dir()
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
            let ss_dir = base_dir.join(".flock/sandbox/screenshots").join(session_id);
            let ss_path = ss_dir.join(format!("{}.png", name_id));
            let _ = std::fs::create_dir_all(&ss_dir);
            let _ = std::fs::write(&ss_path, &img_bytes);
            let _ = std::fs::write(
                base_dir.join(format!(".flock/sandbox/screenshot_{}.png", session_id)),
                &img_bytes,
            );

            let abs_path_str = ss_path.to_string_lossy().to_string();
            return (format!("\n\n![桌面截图](file:///{})", abs_path_str), true);
        }
    }
    (String::new(), false)
}

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
///   * `interactive` — Trigger human takeover mode (suspends the agent and pops up the VNC desktop).
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
/// - When the user explicitly requests manual control (e.g., "let me log in", "I want to do this myself", "open console", "manual input", "I'll take over"), immediately call this tool with `action="interactive"` to delegate control to the user.
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
        let (output, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd).await
            .map_err(|e| format!("沙盒命令执行失败: {}", e))?;

        // 智能动作帧捕获：检测当前是否有拉起 VNC 桌面的状态。
        // 如果有，则在命令完成后也自动截取一张桌面快照，使用户能在 VNC 时间轴上看到命令引起的 UI 变化！
        let mut image_md = String::new();
        if let Ok(ready) = check_computer_use_status(&db, &sandbox_id).await {
            if ready {
                let (md, _) = capture_desktop_screenshot(&db, &sandbox_id, &session_id, &name_id).await;
                image_md = md;
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
        crate::emit_info(&flock_core::tr("检测到 VNC 桌面服务尚未启动，正在向云端拉起桌面服务...", "VNC desktop service not started. Initiating startup request to cloud..."));
        if let Err(e) = start_computer_use_in_sandbox(&db, &sandbox_id).await {
            crate::emit_info(&flock_core::tr(&format!("启动 Daytona 桌面服务请求失败: {}。尝试备用手动方案...", e), &format!("Daytona desktop launch request failed: {}. Trying backup manual startup...", e)));
        }

        // 调用统一的自愈拉起函数，确保 Xvfb, fluxbox, x11vnc, websockify 在 0.0.0.0 运行且 setsid 保活
        let _ = ensure_vnc_running_in_sandbox(&db, &sandbox_id).await;

        crate::emit_info(&flock_core::tr("正在等待远程桌面服务就绪...", "Waiting for remote desktop service to become ready..."));
        for i in 1..=15 {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            if let Ok(ready) = check_computer_use_status(&db, &sandbox_id).await {
                if ready {
                    desktop_ready = true;
                    crate::emit_info(&flock_core::tr("远程桌面服务已就绪！", "Remote desktop service is ready!"));
                    break;
                }
            }
        }

        if !desktop_ready {
            crate::emit_info(&flock_core::tr("警告: 远程桌面未报告就绪状态，继续尝试执行任务。", "Warning: Remote desktop did not report ready status, proceeding with task."));
        }
    }

    // 确保 xdotool 和 scrot 已安装
    let setup_cmd = "sh -c 'if ! command -v xdotool >/dev/null || ! command -v scrot >/dev/null; then sudo apt-get update && sudo apt-get install -y xdotool scrot; fi'";
    let _ = execute_command_in_sandbox(&db, &sandbox_id, setup_cmd).await;

    let mut result_msg = String::new();

    match act.as_str() {
        "interactive" => {
            let proxy_url = match get_sandbox_vnc_url(&db, &sandbox_id).await {
                Ok(url) => url,
                Err(e) => {
                    crate::emit_info(&flock_core::tr(
                        &format!("获取 VNC URL 失败: {}", e),
                        &format!("Failed to get VNC URL: {}", e)
                    ));
                    return Err(format!("无法获取沙盒 VNC 连接地址: {}", e));
                }
            };
            
            if let (Some(cid), Some(mid), Some(app_mgr)) = (call_id.clone(), msg_id, crate::get_global_approval_manager()) {
                crate::emit_info(&flock_core::tr(
                    &format!("检测到敏感桌面操作（验证码/人工介入），正在通知前端拉起人工接管横幅 (Call ID: {})...", cid),
                    &format!("Sensitive desktop action detected (captcha/human verification), notifying client to display takeover banner (Call ID: {})...", cid)
                ));
                crate::daytona::emit_human_takeover(
                    &cid,
                    &mid,
                    "人机协同远程桌面已拉起！检测到当前桌面应用需要人工介入（如滑动拼图验证、扫码登录等），大模型自动执行已暂停。您可以在右侧预览面板中直接操作页面。完成后请点击横幅上的【我已完成操作】按钮以恢复大模型的自动运行。",
                    Some(proxy_url.clone()),
                );

                let rx = app_mgr.request_approval(&cid, &ToolCategory::Exec);
                match rx.await {
                    Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Approved { .. }) => {
                        crate::emit_info(&flock_core::tr("收到前端已完成操作指令，正在恢复 Agent 自动执行。", "Received completion instruction from frontend, resuming automated Agent execution."));
                        result_msg = "人工接管操作已顺利完成，用户已确认！Agent 已经成功从暂停点恢复，并继续自动执行后续流程。".to_string();
                    }
                    Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Denied { reason }) => {
                        crate::emit_info(&flock_core::tr(&format!("人工接管被用户取消: {}", reason), &format!("Human takeover cancelled by user: {}", reason)));
                        return Err(format!("人工接管被取消，原因为: {}", reason));
                    }
                    Err(e) => {
                        crate::emit_info(&flock_core::tr(&format!("人工接管等待通道意外中断: {}", e), &format!("Human takeover wait channel interrupted unexpectedly: {}", e)));
                        return Err(format!("人工接管等待通道意外中断: {}", e));
                    }
                }
            } else {
                result_msg = format!("人机协同远程桌面已拉起！由于当前操作需要人工介入（如验证码、安全登录等），请在右侧预览区进行控制操作。\n\n[Remote VNC Link]({})", proxy_url);
            }
        }
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
            run_xdotool(&db, &sandbox_id, &format!("mousemove {} {} click {}", px, py, click_btn), "鼠标点击").await?;
            result_msg = format!("成功在 ({}, {}) 处执行了鼠标 {} 键点击操作。", px, py, btn);
        }
        "move" => {
            let px = x.unwrap_or(0);
            let py = y.unwrap_or(0);
            run_xdotool(&db, &sandbox_id, &format!("mousemove {} {}", px, py), "鼠标移动").await?;
            result_msg = format!("成功将鼠标移动至坐标 ({}, {})。", px, py);
        }
        "drag" => {
            let px = x.unwrap_or(0);
            let py = y.unwrap_or(0);
            run_xdotool(&db, &sandbox_id, &format!("mousedown 1 mousemove {} {} mouseup 1", px, py), "鼠标拖拽").await?;
            result_msg = format!("成功将元素拖拽移动至坐标 ({}, {})。", px, py);
        }
        "scroll" => {
            let btn = button.unwrap_or_else(|| "down".to_string());
            let scroll_btn = match btn.as_str() {
                "up" => "4",
                _ => "5",
            };
            run_xdotool(&db, &sandbox_id, &format!("click {}", scroll_btn), "鼠标滚动").await?;
            result_msg = format!("成功执行了鼠标向上/下滚动 ({}) 操作。", btn);
        }
        "type" => {
            let t = text.ok_or_else(|| "键盘输入操作缺少必需的 'text' 参数。".to_string())?;
            run_xdotool(&db, &sandbox_id, &format!("type --delay 10 '{}'", t.replace("'", "'\\''")), "键盘输入").await?;
            result_msg = format!("成功向当前聚焦的文本框输入了内容: '{}'。", t);
        }
        "press" => {
            let k = key.ok_or_else(|| "键盘按键操作缺少必需的 'key' 参数。".to_string())?;
            run_xdotool(&db, &sandbox_id, &format!("key '{}'", k), "键盘按键").await?;
            result_msg = format!("成功触发了按键指令: '{}'。", k);
        }
        "screenshot" => {
            result_msg = "已请求截取屏幕当前状态。".to_string();
        }
        _ => {
            return Err(format!("不支持的 ComputerUse 操作类型: '{}'。", act));
        }
    }

    let (image_md, _screenshot_saved) = capture_desktop_screenshot(&db, &sandbox_id, &session_id, &name_id).await;

    let proxy_url = match get_sandbox_vnc_url(&db, &sandbox_id).await {
        Ok(u) => u,
        Err(e) => {
            crate::emit_info(&flock_core::tr(
                &format!("获取动态 VNC URL 失败: {}。", e),
                &format!("Failed to retrieve dynamic VNC URL: {}.", e)
            ));
            return Err(format!("无法获取沙盒 VNC 连接地址: {}", e));
        }
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
