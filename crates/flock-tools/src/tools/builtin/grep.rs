use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;
use tokio::process::Command;

/// Searches file contents using regex patterns (powered by ripgrep).
///
/// IMPORTANT: ALWAYS use this Grep tool for content search. NEVER run grep or rg as a Bash command.
///
/// - Supports full regex syntax (e.g., "log.*Error", "fn\\s+\\w+").
/// - Use the glob parameter to filter by file pattern (e.g., "*.rs").
/// - Output is truncated to 250 lines.
/// - Set case_insensitive to true for case-insensitive search.
///
/// @param pattern The regex pattern to search for
/// @param path Directory to search in (default: cwd)
/// @param glob File filter pattern, e.g. "*.rs"
/// @param case_insensitive Case insensitive search
#[tool("Grep")]
pub async fn grep(
    pattern: String,
    path: Option<String>,
    glob: Option<String>,
    case_insensitive: Option<bool>
) -> Result<String, String> {
    let search_path = path.unwrap_or_else(|| ".".to_string());
    let ci = case_insensitive.unwrap_or(false);

    // Try ripgrep first
    let mut cmd = Command::new("rg");
    cmd.arg(&pattern).arg(&search_path).arg("-n");

    if let Some(g) = glob {
        cmd.arg("--glob").arg(g);
    }
    if ci {
        cmd.arg("-i");
    }

    match cmd.output().await {
        Ok(output) => {
             let stdout = String::from_utf8_lossy(&output.stdout);
             let stderr = String::from_utf8_lossy(&output.stderr);

             if output.status.code() == Some(1) && stdout.is_empty() {
                 return Ok("No matches found".to_string());
             }

             if !output.status.success() && output.status.code() != Some(1) {
                 return Err(format!("rg error: {}", stderr));
             }

             let lines: Vec<&str> = stdout.lines().take(250).collect();
             Ok(lines.join("\n"))
        }
        Err(_) => {
            // Fallback to findstr/grep
             let mut cmd = if cfg!(windows) {
                let mut c = Command::new("findstr");
                c.arg("/S")
                    .arg("/N")
                    .arg("/R")
                    .arg(&pattern)
                    .arg(format!("{}\\*", search_path.trim_end_matches(['\\', '/'])));
                if ci {
                    c.arg("/I");
                }
                c
            } else {
                let mut c = Command::new("grep");
                c.arg("-rn").arg(&pattern).arg(&search_path);
                if ci {
                    c.arg("-i");
                }
                c
            };

            match cmd.output().await {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if stdout.is_empty() {
                        Ok("No matches found".to_string())
                    } else {
                        let lines: Vec<&str> = stdout.lines().take(250).collect();
                        Ok(lines.join("\n"))
                    }
                }
                Err(e) => Err(format!("grep fallback failed: {}", e)),
            }
        }
    }
}

pub struct GrepTool;
impl GrepTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Grep, ToolCategory::Info))
    }
}
