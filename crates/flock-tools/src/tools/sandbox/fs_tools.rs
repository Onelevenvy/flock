use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use crate::daytona::fs::DaytonaFs;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;

/// Reads a file from the Daytona sandbox filesystem.
///
/// Usage:
/// - Paths are always resolved under the sandbox workspace mount (`/workspace`).
/// - You may pass either:
///   - a relative path (for example: `src/main.py`)
///   - an absolute workspace path (for example: `/workspace/src/main.py`)
/// - Non-workspace absolute paths will be normalized into workspace-relative paths.
/// - This tool reads from the active sandbox instance, not from the local host.
/// - Use this tool for deterministic file reads instead of shelling out with `SandboxExec`.
///
/// IMPORTANT PATH RULES:
/// - The sandbox workspace is mounted at `/workspace` - all file operations should use this path
/// - Use relative paths like `file.txt` or `subdir/file.txt` (automatically mapped to `/workspace/...`)
/// - Or use absolute paths starting with `/workspace/` like `/workspace/file.txt`
/// - Do NOT use local machine paths like `/Users/...` or `C:\...` - they don't exist in the sandbox
///
/// @param path The file path to read (mapped into `/workspace`).
#[tool("SandboxRead")]
pub async fn sandbox_read(path: String) -> Result<String, String> {
    let db = crate::get_db_manager().ok_or_else(|| "Database manager not initialized".to_string())?;
    DaytonaFs::read_file(&db, &path).await.map_err(|e| format!("读取失败: {}", e))
}

/// Writes content to a file in the Daytona sandbox filesystem.
///
/// Usage:
/// - Paths are always resolved under the sandbox workspace mount (`/workspace`).
/// - You may pass either a relative path (`web/index.html`) or `/workspace/...`.
/// - This tool overwrites the file content at `path`.
/// - Parent directory creation behavior depends on the underlying sandbox filesystem API.
/// - Use this tool for structured file writes instead of composing shell redirection commands.
/// - Files are automatically synced to local workspace for preview and access.
///
/// IMPORTANT PATH RULES:
/// - The sandbox workspace is mounted at `/workspace` - all file operations should use this path
/// - Use relative paths like `file.txt` or `subdir/file.txt` (automatically mapped to `/workspace/...`)
/// - Or use absolute paths starting with `/workspace/` like `/workspace/file.txt`
/// - Do NOT use local machine paths like `/Users/...` or `C:\...` - they don't exist in the sandbox
///
/// @param path The file path to write (mapped into `/workspace`).
/// @param content The full content to write into the target file.
#[tool("SandboxWrite")]
pub async fn sandbox_write(path: String, content: String) -> Result<String, String> {
    let db = crate::get_db_manager().ok_or_else(|| "Database manager not initialized".to_string())?;
    // Write to cloud sandbox
    DaytonaFs::write_file(&db, &path, &content).await.map_err(|e| format!("写入失败: {}", e))?;

    // Auto-sync to local workspace for preview and access
    if let Some(workspace_dir) = crate::get_workspace_dir() {
        let rel_path = DaytonaFs::normalize_workspace_relative_path(&path)
            .map_err(|e| format!("路径规范化失败: {}", e))?;
        let local_path = workspace_dir.join(&rel_path);

        // Create parent directories if needed
        if let Some(parent) = local_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                crate::emit_info(&flock_core::tr(&format!("创建本地目录失败: {}", e), &format!("Failed to create local directory: {}", e)));
            }
        }

        // Write file to local workspace
        if let Err(e) = std::fs::write(&local_path, &content) {
            crate::emit_info(&flock_core::tr(&format!("同步到本地失败: {} (文件仍在云端沙盒中)", e), &format!("Sync to local failed: {} (File remains in sandbox)", e)));
        }
    }

    Ok(format!("Successfully wrote to {}", path))
}

/// Replaces text in a file inside the Daytona sandbox filesystem.
///
/// Usage:
/// - Paths are always resolved under the sandbox workspace mount (`/workspace`).
/// - Use a relative path or `/workspace/...`.
/// - The tool first reads the file, then replaces all occurrences of `old_text`
///   with `new_text`, and writes the updated content back.
/// - Returns an error if `old_text` does not exist in the file.
/// - Files are automatically synced to local workspace for preview and access.
///
/// IMPORTANT PATH RULES:
/// - The sandbox workspace is mounted at `/workspace` - all file operations should use this path
/// - Use relative paths like `file.txt` or `subdir/file.txt` (automatically mapped to `/workspace/...`)
/// - Or use absolute paths starting with `/workspace/` like `/workspace/file.txt`
/// - Do NOT use local machine paths like `/Users/...` or `C:\...` - they don't exist in the sandbox
///
/// @param path The file path to edit (mapped into `/workspace`).
/// @param old_text The exact text fragment to search for.
/// @param new_text The replacement text.
#[tool("SandboxEdit")]
pub async fn sandbox_edit(path: String, old_text: String, new_text: String) -> Result<String, String> {
    let db = crate::get_db_manager().ok_or_else(|| "Database manager not initialized".to_string())?;
    let content = DaytonaFs::read_file(&db, &path).await.map_err(|e| format!("读取失败: {}", e))?;
    if !content.contains(&old_text) {
        return Err("The old_text was not found in the file.".to_string());
    }

    let new_content = content.replace(&old_text, &new_text);
    DaytonaFs::write_file(&db, &path, &new_content).await.map_err(|e| format!("写入失败: {}", e))?;

    // Auto-sync to local workspace for preview and access
    if let Some(workspace_dir) = crate::get_workspace_dir() {
        let rel_path = DaytonaFs::normalize_workspace_relative_path(&path)
            .map_err(|e| format!("路径规范化失败: {}", e))?;
        let local_path = workspace_dir.join(&rel_path);

        // Create parent directories if needed
        if let Some(parent) = local_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                crate::emit_info(&flock_core::tr(&format!("创建本地目录失败: {}", e), &format!("Failed to create local directory: {}", e)));
            }
        }

        // Write file to local workspace
        if let Err(e) = std::fs::write(&local_path, &new_content) {
            crate::emit_info(&flock_core::tr(&format!("同步到本地失败: {} (文件仍在云端沙盒中)", e), &format!("Sync to local failed: {} (File remains in sandbox)", e)));
        }
    }

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
