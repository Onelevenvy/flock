use crate::adapter::LangGraphToolAdapter;
use crate::file_cache::file_mtime_ms;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::file_state::FileState;
use langgraph::tool;
use std::path::Path;

/// Stub returned when a file has not changed since the model last read it.
/// Saves tokens by avoiding re-sending identical content.
const FILE_UNCHANGED_STUB: &str = "File unchanged since last read. The content from the earlier Read \
     tool_result in this conversation is still current — refer to that \
     instead of re-reading.";

/// Reads a file from the local filesystem. Returns content with line numbers.
///
/// Usage:
/// - The file_path parameter must be an absolute path, not a relative path.
/// - By default, it reads the entire file. Use offset and limit for partial reads on large files.
/// - Results are returned with line numbers (1-based) followed by a tab and the line content.
/// - Binary files return "(binary file, N bytes)" instead of content.
/// - This tool can only read files, not directories. To list a directory, use Bash with ls.
///
/// @param file_path The absolute path to the file to read
/// @param offset Line number to start reading from (0-based)
/// @param limit Maximum number of lines to read
#[tool("Read")]
pub async fn read(
    file_path: String,
    offset: Option<usize>,
    limit: Option<usize>
) -> Result<String, String> {
    let path = Path::new(&file_path);
    
    // 1. 获取当前文件的修改时间
    let mtime_ms = file_mtime_ms(path);

    // 2. 只有在 mtime_ms 存在且能够获取到全局缓存时，才执行 Dedup 检查
    if let (Some(current_mtime), Some(cache_arc)) = (mtime_ms, crate::get_file_cache()) {
 
    if let Ok(mut cache) = cache_arc.write() { 
        if let Some(cached) = cache.get(path) { // 调用会更新 LRU 内部顺序
            if cached.mtime_ms == current_mtime
                && cached.offset == offset
                && cached.limit == limit
            {
                return Ok(FILE_UNCHANGED_STUB.to_string());
            }
        }
    }
}

    // 3. 读取文件内容
    let content = std::fs::read(path).map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;

    // 4. 二进制检查 (前 8KB 是否包含空字节)
    if content.iter().take(8192).any(|&b| b == 0) {
        return Ok(format!("(binary file, {} bytes)", content.len()));
    }

    // 5. 文本处理与切片
    let text = String::from_utf8_lossy(&content);
    let lines: Vec<&str> = text.lines().collect();

    let total_lines = lines.len();
    let effective_offset = offset.unwrap_or(0);
    // 确保 offset 不会越界
    let start = effective_offset.min(total_lines);
    let end = limit
        .map(|l| (start + l).min(total_lines))
        .unwrap_or(total_lines);

    let slice = &lines[start..end];

    // 6. 格式化带行号的文本
    let result_content: String = slice
        .iter()
        .enumerate()
        .map(|(i, line)| format!("{:>6}\t{}", start + i + 1, line))
        .collect::<Vec<String>>()
        .join("\n");

    // 7. 成功读取后，更新全局缓存
    if let (Some(current_mtime), Some(cache_arc)) = (mtime_ms, crate::get_file_cache()) {
        if let Ok(mut cache) = cache_arc.write() {
            cache.insert(
                file_path.into(),
                FileState {
                    content: result_content.clone(),
                    mtime_ms: current_mtime,
                    offset,
                    limit,
                },
            );
        }
    }

    Ok(result_content)
}

pub struct ReadTool;
impl ReadTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(Read, ToolCategory::Info))
    }
}