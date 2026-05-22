use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::{get_or_create_active_sandbox, execute_command_in_sandbox};
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

/// Executes Python code securely inside the cloud-based Daytona sandbox.
///
/// Usage:
/// - Use this tool when you need to perform calculations, analyze data, or run custom code logic.
/// - The execution is fully isolated and does not affect the host machine.
/// - Results will be written to the log file `.flock/sandbox/code_result.log` and shown in the preview panel.
///
/// @param code The Python code content to execute.
#[tool("CodeExecution")]
pub async fn code_execution(code: String) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    // 2. 将代码通过 Base64 编码，避免 shell 转义引发的问题，并写入沙盒执行
    let b64_code = general_purpose::STANDARD.encode(code.as_bytes());
    let setup_and_run_cmd = format!(
        "mkdir -p /tmp && echo '{}' | base64 -d > /tmp/run_code.py && python3 /tmp/run_code.py",
        b64_code
    );

    crate::emit_info("正在沙盒中执行代码...");
    let (stdout_stderr, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &setup_and_run_cmd).await
        .map_err(|e| format!("代码执行失败: {}", e))?;

    // 3. 将结果写到本地日志文件 `.flock/sandbox/code_result.log` 供前端预览
    let log_path = crate::get_workspace_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
        .join(".flock/sandbox/code_result.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    
    let log_content = format!(
        "--- Daytona Sandbox Code Execution ---\nExit Code: {}\n\n--- Output ---\n{}",
        exit_code, stdout_stderr
    );
    let _ = std::fs::write(&log_path, &log_content);

    if exit_code == 0 {
        Ok(format!("代码执行成功。\n\n[输出结果]\n{}", stdout_stderr))
    } else {
        Err(format!("代码执行失败，退出码: {}。\n\n[错误输出]\n{}", exit_code, stdout_stderr))
    }
}

pub struct CodeExecutionToolImpl;
impl CodeExecutionToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(CodeExecution, ToolCategory::Exec)
                .with_provider_id("sandbox")
                .with_provider_name("Sandbox"),
        )
    }
}
