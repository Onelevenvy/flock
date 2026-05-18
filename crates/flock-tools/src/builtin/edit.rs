use crate::adapter::LangGraphToolAdapter;
use crate::file_cache::{file_mtime_ms, update_cache_after_write};
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;
use std::path::Path;

/// Performs exact string replacements in files.
///
/// Usage:
/// - You must use the Read tool first before editing a file.
/// - The old_string must be unique in the file. If multiple matches exist, the edit will fail.
/// - Use replace_all for renaming variables or replacing all instances of a string.
/// - Prefer Edit over Write for modifying existing files — Edit only sends the diff.
/// - When matching text from Read output, preserve the exact indentation (tabs/spaces).
///
/// @param file_path The absolute path to the file to modify
/// @param old_string The exact string to replace (must be unique in the file)
/// @param new_string The replacement string
/// @param replace_all Replace all occurrences (default false)
#[tool("Edit")]
pub async fn edit(
    file_path: String,
    old_string: String,
    new_string: String,
    replace_all: Option<bool>
) -> Result<String, String> {
    let path = Path::new(&file_path);
    let replace_all_bool = replace_all.unwrap_or(false);

    // Cache guard: "must Read first" + staleness detection.
    if let Some(cache_arc) = crate::get_file_cache() {
        let mut cache = cache_arc.write().map_err(|e| format!("Cache write error: {}", e))?;
        let cached = cache.get(path);
        if cached.is_none() {
            return Err(format!(
                "You must Read {} before editing. Use the Read tool first \
                 so the file content is loaded into context.",
                file_path
            ));
        }
        // Staleness check: compare cached mtime with current disk mtime.
        let cached_mtime = cached.map(|s| s.mtime_ms);
        let disk_mtime = file_mtime_ms(path);
        if let (Some(cached_mt), Some(disk_mt)) = (cached_mtime, disk_mtime) {
            if cached_mt != disk_mt {
                return Err(format!(
                    "File {} has been modified externally since last read. \
                     Read the file again to see the current content before editing.",
                    file_path
                ));
            }
        }
    }

    let content = std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
    let match_count = content.matches(&old_string).count();

    if match_count == 0 {
        return Err("old_string not found in file".to_string());
    }

    if match_count > 1 && !replace_all_bool {
        return Err(format!(
            "Multiple matches found ({}). Use replace_all or provide more context.",
            match_count
        ));
    }

    let new_content = if replace_all_bool {
        content.replace(&old_string, &new_string)
    } else {
        content.replacen(&old_string, &new_string, 1)
    };

    std::fs::write(&file_path, &new_content).map_err(|e| format!("Failed to write file: {}", e))?;

    // Post-write cache update: refresh mtime and content.
    if let Some(cache_arc) = crate::get_file_cache() {
        update_cache_after_write(&cache_arc, path, &new_content);
    }

    Ok(format!(
        "Edited {}: replaced {} occurrence(s)",
        file_path, match_count
    ))
}

pub struct EditTool;
impl EditTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Edit, ToolCategory::Edit))
    }
}
