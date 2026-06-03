use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::config::shell::shell_command;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::time::Duration;

const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const MAX_TIMEOUT_MS: u64 = 600_000;

/// Executes a shell command and returns its output.
///
/// IMPORTANT: Do NOT use Bash when a dedicated tool is available:
/// - File search: use Glob (not find or ls)
/// - Content search: use Grep (not grep or rg)
/// - Read files: use Read (not cat, head, or tail)
/// - Edit files: use Edit (not sed or awk)
/// - Write files: use Write (not echo or cat with heredoc)
///
/// # Instructions
/// - Use absolute paths to avoid working directory confusion.
/// - When issuing multiple independent commands, make parallel tool calls instead of chaining them. Use `&&` only when commands depend on each other.
/// - You may specify an optional timeout in milliseconds (default 120000, max 600000).
///
/// # Git safety
/// - Never force push, reset --hard, or use --no-verify unless explicitly asked.
/// - Prefer creating new commits over amending existing ones.
///
/// @param command The command to execute
/// @param timeout Timeout in milliseconds (default 120000, max 600000)
#[tool("Bash")]
pub async fn bash(
    command: String,
    timeout: Option<u64>
) -> Result<String, String> {
    let timeout_ms = timeout
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .min(MAX_TIMEOUT_MS);

    let timeout_dur = Duration::from_millis(timeout_ms);

    let result = tokio::time::timeout(timeout_dur, async { shell_command(&command).await }).await;

    match result {
        Ok(Ok(output)) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let exit_code = output.status.code().unwrap_or(-1);

            let content = format!(
                "Exit code: {}\nSTDOUT:\n{}\nSTDERR:\n{}",
                exit_code, stdout, stderr
            );

            if exit_code == 0 {
                Ok(content)
            } else {
                Err(content)
            }
        }
        Ok(Err(e)) => Err(format!("Failed to execute command: {}", e)),
        Err(_) => Err(format!("Command timed out after {}ms", timeout_ms)),
    }
}

pub struct BashTool;
impl BashTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Bash, ToolCategory::Exec))
    }
}
