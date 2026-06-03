use flock_core::types::message::ContentBlock;
use base64::Engine;

/// Extract image references from tool result content and convert them to
/// inline Image content blocks for multimodal LLM consumption.
///
/// Scans for markdown image syntax `![...](file:///path)` and converts
/// found images to base64-encoded ContentBlock::Image entries.
pub fn extract_images_from_tool_result(
    content: String,
    tool_use_id: String,
    is_error: bool,
) -> Vec<ContentBlock> {
    let mut blocks = Vec::new();
    blocks.push(ContentBlock::ToolResult {
        tool_use_id,
        content: content.clone(),
        is_error,
    });

    let re = regex::Regex::new(r"!\[.*?\]\((file://(.*?))\)").unwrap();
    for cap in re.captures_iter(&content) {
        if let Some(path_match) = cap.get(2) {
            let path = path_match.as_str();
            if let Ok(bytes) = std::fs::read(path) {
                let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                let ext = path.split('.').last().unwrap_or("").to_lowercase();
                let mime = match ext.as_str() {
                    "png" => "image/png",
                    "jpeg" | "jpg" => "image/jpeg",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    _ => "image/png",
                }
                .to_string();

                blocks.push(ContentBlock::Image {
                    media_type: mime,
                    data: base64,
                });
            }
        }
    }
    blocks
}
