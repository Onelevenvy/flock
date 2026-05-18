use crate::adapter::LangGraphToolAdapter;
use crate::file_cache::update_cache_after_write;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::path::Path;

/// Writes content to a file, creating parent directories if needed.
///
/// Usage:
/// - This tool overwrites the existing file completely (not append).
/// - If the file already exists, you must use Read first to see its current content.
/// - Prefer Edit over Write for modifying existing files — Edit only sends the diff.
/// - Use Write only for creating new files or complete rewrites.
///
/// @param file_path The absolute path to the file to write
/// @param content The content to write to the file
#[tool("Write")]
pub async fn write(
    file_path: String,
    content: String
) -> Result<String, String> {
    let path = Path::new(&file_path);
    let existed = path.exists();

    // Create parent directories
    if let Some(parent) = path.parent().filter(|p| !p.exists()) {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    // Write atomically: write to temp file, then rename
    let tmp_path = format!("{}.tmp.{}", file_path, std::process::id());
    std::fs::write(&tmp_path, &content).map_err(|e| format!("Failed to write file: {}", e))?;

    if let Err(e) = std::fs::rename(&tmp_path, &file_path) {
        // Fallback: direct write if rename fails (cross-device)
        let _ = std::fs::remove_file(&tmp_path);
        std::fs::write(&file_path, &content).map_err(|e| format!("Failed to write file: {}", e))?;
        
        if let Some(cache_arc) = crate::get_file_cache() {
            update_cache_after_write(&cache_arc, path, &content);
        }

        return Ok(format!(
            "Updated {} (rename failed: {}, used direct write)",
            file_path, e
        ));
    }

    if let Some(cache_arc) = crate::get_file_cache() {
        update_cache_after_write(&cache_arc, path, &content);
    }

    let line_count = content.lines().count();
    let action = if existed { "Updated" } else { "Created" };
    Ok(format!("{} {} ({} lines)", action, file_path, line_count))
}

pub struct WriteTool;
impl WriteTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Write, ToolCategory::Edit))
    }
}
