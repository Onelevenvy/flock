use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::path::Path;

const MAX_RESULTS: usize = 100;

/// Fast file pattern matching tool that works with any codebase size.
///
/// - Supports glob patterns like "**/*.rs" or "src/**/*.ts".
/// - Returns matching file paths sorted by modification time (newest first).
/// - Returns at most 100 results. Only returns files, not directories.
/// - The path parameter defaults to the current working directory.
/// - Use this tool when you need to find files by name or extension patterns.
///
/// @param pattern The glob pattern to match files against
/// @param path The directory to search in (default: cwd)
#[tool("Glob")]
pub async fn glob(
    pattern: String,
    path: Option<String>
) -> Result<String, String> {
    let root = path.unwrap_or_else(|| ".".to_string());
    let root_path = Path::new(&root);

    // Build full glob pattern
    let full_pattern = if pattern.starts_with('/') {
        pattern.clone()
    } else {
        format!("{}/{}", root_path.display(), pattern)
    };

    let entries = match glob::glob(&full_pattern) {
        Ok(paths) => paths,
        Err(e) => return Err(format!("Invalid glob pattern: {}", e)),
    };

    let mut files: Vec<(std::time::SystemTime, String)> = Vec::new();

    for entry in entries {
        if files.len() >= MAX_RESULTS {
            break;
        }

        let Ok(path_buf) = entry else {
            continue;
        };
        if !path_buf.is_file() {
            continue;
        }

        let mtime = path_buf
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

        // Make path relative to root
        let display_path = path_buf
            .strip_prefix(root_path)
            .unwrap_or(&path_buf)
            .display()
            .to_string();

        files.push((mtime, display_path));
    }

    // Sort by modification time, newest first
    files.sort_by_key(|f| std::cmp::Reverse(f.0));

    if files.is_empty() {
        return Ok("No files matched the pattern".to_string());
    }

    let result: Vec<String> = files.into_iter().map(|(_, p)| p).collect();
    Ok(result.join("\n"))
}

pub struct GlobTool;
impl GlobTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Glob, ToolCategory::Info))
    }
}
