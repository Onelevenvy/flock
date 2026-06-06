use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{ProviderInfo, I18nString};
use langgraph::tool;
use serde_json::Value;
use md5::{Md5, Digest};

/// Translate text using Baidu Translate API.
///
/// @param content The text content you need to translate
/// @param dest The destination language you want to translate (e.g., "zh", "en")
#[tool("Baidu Translate")]
pub async fn baidu_translate(content: String, dest: String) -> Result<String, String> {
    let creds_json = crate::resolve_provider_credentials("baidu")
        .await
        .unwrap_or_default();
    
    let creds: Value = serde_json::from_str(&creds_json).unwrap_or_default();
    
    let appid = creds.get("BAIDU_APPID")
        .and_then(|v| v.get("value"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_default();
        
    let secret_key = creds.get("BAIDU_SECRETKEY")
        .and_then(|v| v.get("value"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_default();

    if appid.is_empty() || secret_key.is_empty() {
        return Err("Baidu API credentials are not set. Please authorize in the Plugins page.".to_string());
    }

    let salt = format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let sign_str = format!("{}{}{}{}", appid, content, salt, secret_key);
    let mut hasher = Md5::new();
    hasher.update(sign_str.as_bytes());
    let sign = format!("{:x}", hasher.finalize());

    let client = reqwest::Client::new();
    let resp = client
        .get("https://fanyi-api.baidu.com/api/trans/vip/translate")
        .query(&[
            ("appid", appid.as_str()),
            ("q", content.as_str()),
            ("from", "auto"),
            ("to", dest.as_str()),
            ("salt", salt.as_str()),
            ("sign", sign.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Baidu Translate API request failed: {}", e))?;

    if resp.status().is_success() {
        let data: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
            
        if let Some(trans_result) = data.get("trans_result").and_then(|v| v.as_array()) {
            if let Some(first) = trans_result.first() {
                if let Some(dst) = first.get("dst").and_then(|v| v.as_str()) {
                    return Ok(dst.to_string());
                }
            }
        }
        Err(format!("Translation failed: {}", data))
    } else {
        Err(format!("Failed with status code: {}", resp.status()))
    }
}

pub struct BaiduTool;
impl BaiduTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(BaiduTranslate, ToolCategory::Exec)
                .with_provider_id("baidu")
                .with_provider_name("Baidu Translate"),
        )
    }
}

pub fn provider_info() -> ProviderInfo {
    crate::parse_provider_info_from_yaml(
        include_str!("provider.yaml"),
        Some(include_str!("icon.svg")),
    )
}
