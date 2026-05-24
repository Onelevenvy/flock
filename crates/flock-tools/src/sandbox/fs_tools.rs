use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::fs::DaytonaFs;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph_derive::tool;

/// Reads a file from the Daytona sandbox filesystem.
///
/// Usage:
/// - The `path` parameter should be an absolute Linux path inside the sandbox
///   (for example: `/home/daytona/project/main.py`).
/// - This tool reads from the active sandbox instance, not from the local host.
/// - Use this tool for deterministic file reads instead of shelling out with `SandboxExec`.
///
/// @param path The absolute file path inside the sandbox to read.
#[tool("SandboxRead")]
pub async fn sandbox_read(path: String) -> Result<String, String> {
    let db = crate::get_db_manager().ok_or_else(|| "Database manager not initialized".to_string())?;
    crate::emit_info(&format!("正在沙盒中读取文件: {}...", path));
    DaytonaFs::read_file(&db, &path).await.map_err(|e| format!("读取失败: {}", e))
}

/// Writes content to a file in the Daytona sandbox filesystem.
///
/// Usage:
/// - The `path` parameter should be an absolute Linux path inside the sandbox.
/// - This tool overwrites the file content at `path`.
/// - Parent directory creation behavior depends on the underlying sandbox filesystem API.
/// - Use this tool for structured file writes instead of composing shell redirection commands.
///
/// @param path The absolute file path inside the sandbox to write.
/// @param content The full content to write into the target file.
#[tool("SandboxWrite")]
pub async fn sandbox_write(path: String, content: String) -> Result<String, String> {
    let db = crate::get_db_manager().ok_or_else(|| "Database manager not initialized".to_string())?;
    crate::emit_info(&format!("正在沙盒中写入文件: {}...", path));
    DaytonaFs::write_file(&db, &path, &content).await.map_err(|e| format!("写入失败: {}", e))?;
    Ok(format!("Successfully wrote to {}", path))
}

/// Replaces text in a file inside the Daytona sandbox filesystem.
///
/// Usage:
/// - The `path` parameter should be an absolute Linux path inside the sandbox.
/// - The tool first reads the file, then replaces all occurrences of `old_text`
///   with `new_text`, and writes the updated content back.
/// - Returns an error if `old_text` does not exist in the file.
///
/// @param path The absolute file path inside the sandbox to edit.
/// @param old_text The exact text fragment to search for.
/// @param new_text The replacement text.
#[tool("SandboxEdit")]
pub async fn sandbox_edit(path: String, old_text: String, new_text: String) -> Result<String, String> {
    let db = crate::get_db_manager().ok_or_else(|| "Database manager not initialized".to_string())?;
    crate::emit_info(&format!("正在沙盒中编辑文件: {}...", path));
    
    let content = DaytonaFs::read_file(&db, &path).await.map_err(|e| format!("读取失败: {}", e))?;
    if !content.contains(&old_text) {
        return Err("The old_text was not found in the file.".to_string());
    }
    
    let new_content = content.replace(&old_text, &new_text);
    DaytonaFs::write_file(&db, &path, &new_content).await.map_err(|e| format!("写入失败: {}", e))?;
    Ok(format!("Successfully edited {}", path))
}

pub struct SandboxReadToolImpl;
impl SandboxReadToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(SandboxRead, ToolCategory::Info).with_provider_id("sandbox").with_provider_name("Sandbox"))
    }
}

pub struct SandboxWriteToolImpl;
impl SandboxWriteToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(SandboxWrite, ToolCategory::Edit).with_provider_id("sandbox").with_provider_name("Sandbox"))
    }
}

pub struct SandboxEditToolImpl;
impl SandboxEditToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(SandboxEdit, ToolCategory::Edit).with_provider_id("sandbox").with_provider_name("Sandbox"))
    }
}
