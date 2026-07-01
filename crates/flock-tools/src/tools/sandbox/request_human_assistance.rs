use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::sandbox_core::manager::{get_or_create_active_sandbox, get_sandbox_vnc_url};
use crate::sandbox_core::daytona::{
    start_computer_use_in_sandbox, ensure_vnc_running_in_sandbox
};
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;

/// Proactively requests manual human takeover and displays the collaborative remote VNC panel.
///
/// Use this tool immediately when you encounter hurdles you cannot overcome automatically, such as:
/// - Security verifications: Captchas, slide puzzles, 2FA prompt inputs, SMS one-time passcodes.
/// - Credentials: Users need to sign in with their personal accounts/passwords.
/// - Checkout: Scanning QR codes to pay, confirm transactions, or complete checkouts.
/// - Errors/Logic barriers: Blocked by unexpected visual overlays, or automated flows that keep failing.
///
/// After calling this tool, your automated execution will be paused, letting the user operate.
/// Once the user clicks "I've finished", you will receive the success result and can resume your automated task.
///
/// @param reason The specific reason why you are requesting human intervention (e.g. "I encountered a hCaptcha, please solve it").
#[tool("RequestHumanAssistance")]
pub async fn request_human_assistance(
    reason: String,
    call_id: Option<String>,
    msg_id: Option<String>,
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    // 1. 获取或拉起沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    // 2. 确保 VNC 等图形控制台及代理处于开启保活状态
    crate::emit_info(&flock_core::tr("正在确保远程桌面图形服务运行就绪...", "Ensuring remote desktop graphical service is running and ready..."));
    if let Err(e) = start_computer_use_in_sandbox(&db, &sandbox_id).await {
        crate::emit_info(&flock_core::tr(&format!("启动 Daytona 桌面服务请求失败: {}", e), &format!("Failed to request Daytona desktop service startup: {}", e)));
    }
    let _ = ensure_vnc_running_in_sandbox(&db, &sandbox_id).await;

    // 3. 拿到当前的 VNC 控制台 URL 链接
    let proxy_url = match get_sandbox_vnc_url(&db, &sandbox_id).await {
        Ok(u) => u,
        Err(e) => {
            crate::emit_info(&flock_core::tr(
                &format!("获取 VNC URL 失败: {}", e),
                &format!("Failed to get VNC URL: {}", e)
            ));
            return Err(format!("无法获取沙盒 VNC 连接地址: {}", e));
        }
    };

    // 4. 调用 approval_manager 触发前端人工接管挂起逻辑
    if let (Some(cid), Some(mid), Some(app_mgr)) = (call_id.clone(), msg_id, crate::get_global_approval_manager()) {
        crate::emit_info(&flock_core::tr(
            &format!("大模型已主动申请人工接管。原因: {}。正在向前端发送接管请求...", reason),
            &format!("Model requested manual takeover. Reason: {}. Sending takeover request to frontend...", reason)
        ));
        
        let display_message = format!(
            "大模型已主动暂停运行，并请求人工接入支持！\n\n原因说明：{}\n\n请在右侧预览面板中直接操作页面。完成后请点击接管横幅上的【我已完成操作】以恢复大模型的自动运行。",
            reason
        );

        crate::sandbox_core::state::emit_human_takeover(
            &cid,
            &mid,
            &display_message,
            Some(proxy_url.clone()),
        );

        // 挂起并等待前端 approve_tool 事件（用户点击“我已完成操作”）
        let rx = app_mgr.request_approval(&cid, &ToolCategory::Exec);
        match rx.await {
            Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Approved { .. }) => {
                crate::emit_info(&flock_core::tr("用户已在前端完成人工确认，大模型恢复自动运转。", "User confirmed manually on the frontend. Resuming automated model execution."));
                return Ok(format!("人工接管顺利完成。用户已确认可以继续，之前接管原因: {}", reason));
            }
            Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Denied { reason: deny_reason }) => {
                crate::emit_info(&flock_core::tr(&format!("用户拒绝了人工确认: {}", deny_reason), &format!("User denied manual confirmation: {}", deny_reason)));
                return Err(format!("用户在人工接管中拒绝了该操作，大模型自动执行被中断。原因: {}", deny_reason));
            }
            Err(e) => {
                crate::emit_info(&flock_core::tr(&format!("人工接管挂起异常终止: {}", e), &format!("Human takeover wait interrupted with error: {}", e)));
                return Err(format!("人工接管等待过程中发生异常挂起: {}", e));
            }
        }
    }

    Ok(format!("未找到有效的 approval_manager 挂起上下文，已跳过挂起，VNC 正常开启。URL: {}", proxy_url))
}

pub struct RequestHumanAssistanceToolImpl;
impl RequestHumanAssistanceToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(RequestHumanAssistance, ToolCategory::Exec)
                .with_provider_id("sandbox")
                .with_provider_name("Sandbox"),
        )
    }
}
