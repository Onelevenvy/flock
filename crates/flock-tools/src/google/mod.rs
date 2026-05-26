use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{ProviderInfo, I18nString};
use langgraph_derive::tool;
use serde_json::Value;

/// Translate text using Google Translate.
///
/// @param content The text content you need to translate
/// @param dest The destination language you want to translate (e.g., "zh-CN", "en")
#[tool("Google Translate")]
pub async fn google_translate(content: String, dest: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://translate.googleapis.com/translate_a/single")
        .query(&[
            ("client", "gtx"),
            ("sl", "auto"),
            ("tl", dest.as_str()),
            ("dt", "t"),
            ("q", content.as_str()),
        ])
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("Google Translate request failed: {}", e))?;

    if resp.status().is_success() {
        let data: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
            
        if let Some(arr) = data.as_array() {
            if let Some(first_arr) = arr.first().and_then(|v| v.as_array()) {
                let mut translated_text = String::new();
                for item in first_arr {
                    if let Some(part) = item.as_array().and_then(|v| v.first()).and_then(|v| v.as_str()) {
                        translated_text.push_str(part);
                    }
                }
                return Ok(translated_text);
            }
        }
        Err(format!("Translation failed: {}", data))
    } else {
        Err(format!("Failed with status code: {}", resp.status()))
    }
}

pub struct GoogleTool;
impl GoogleTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(GoogleTranslate, ToolCategory::Exec)
                .with_provider_id("google")
                .with_provider_name("Google Translate"),
        )
    }
}

pub fn provider_info() -> ProviderInfo {
    crate::parse_provider_info_from_yaml(include_str!("provider.yaml"))
}
