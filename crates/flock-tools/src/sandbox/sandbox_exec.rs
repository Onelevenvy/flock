use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::{get_or_create_active_sandbox, execute_command_in_sandbox};
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;

/// Execute a shell command directly inside the cloud-based Daytona sandbox.
///
/// Usage:
/// - Use this tool to run any shell command in the sandbox environment (e.g. mkdir, ls, rm, cat, python3, etc.).
/// - This is the RECOMMENDED tool for file system operations inside the sandbox.
/// - The sandbox runs Linux (Ubuntu). Commands execute in `/workspace` by default.
/// - Use this tool instead of `ComputerUse` when you just need to run a command without GUI interaction.
///
/// IMPORTANT PATH RULES:
/// - The sandbox workspace is mounted at `/workspace` - all file operations should use this path
/// - Use relative paths like `file.txt` or `subdir/file.txt` (automatically mapped to `/workspace/...`)
/// - Or use absolute paths starting with `/workspace/` like `/workspace/file.txt`
/// - Do NOT use local machine paths like `/Users/...` or `C:\...` - they don't exist in the sandbox
/// - Files written to `/workspace` are automatically synced to local workspace for preview
///
/// Examples:
/// - Create a directory: command="mkdir /workspace/my_project"
/// - List files: command="ls -la /workspace"
/// - Run a script: command="python3 /tmp/my_script.py"
/// - Install a package: command="pip install requests"
///
/// @param command The shell command to execute in the sandbox.
/// @param cwd Optional working directory (default: /workspace).
/// @param timeout Optional timeout in seconds (default: 60).
#[tool("SandboxExec")]
pub async fn sandbox_exec(
    command: String,
    cwd: Option<String>,
    timeout: Option<u32>,
) -> Result<String, String> {
    let db = crate::get_db_manager()
        .ok_or_else(|| "数据库管理器未初始化，无法读取沙箱配置。".to_string())?;

    // 1. 获取或创建沙盒环境
    let sandbox_id = get_or_create_active_sandbox(&db).await
        .map_err(|e| format!("沙盒环境启动失败: {}", e))?;

    // 2. 构建完整命令（支持 cwd）
    let final_cmd = if let Some(dir) = cwd {
        format!("cd {} && {}", dir, command)
    } else {
        command.clone()
    };

    // timeout 目前通过 execute_command_in_sandbox 内置处理（60s），
    // 如果用户指定了 timeout，将其编织进命令
    let cmd_with_timeout = if let Some(t) = timeout {
        format!("timeout {} bash -c '{}'", t, final_cmd.replace('\'', "'\\''"))
    } else {
        final_cmd
    };

    crate::emit_info(&format!("正在沙盒中执行命令: {}...", command));
    let (output, exit_code) = execute_command_in_sandbox(&db, &sandbox_id, &cmd_with_timeout).await
        .map_err(|e| format!("沙盒命令执行失败: {}", e))?;

    // 每次执行后拉取变更到本地 (异步后台执行以防止阻塞终端瞬间返回)
    if let Some(ws_path) = crate::get_workspace_dir() {
        let db_clone = db.clone();
        let sandbox_id_clone = sandbox_id.clone();
        tokio::spawn(async move {
            if let Err(e) = crate::daytona::sync::sync_down(&db_clone, &sandbox_id_clone, &ws_path).await {
                crate::emit_info(&format!("自动 Sync Down 失败: {}", e));
            }
        });
    }

    if exit_code == 0 {
        Ok(format!("命令执行成功 (退出码: 0)。\n\n[输出]\n{}", output))
    } else {
        Err(format!("命令执行失败 (退出码: {})。\n\n[错误输出]\n{}", exit_code, output))
    }
}

pub struct SandboxExecToolImpl;
impl SandboxExecToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(SandboxExec, ToolCategory::Exec)
                .with_provider_id("sandbox")
                .with_provider_name("Sandbox"),
        )
    }
}
