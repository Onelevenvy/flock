use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::ProviderInfo;
use langgraph_derive::tool;
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
    ProviderInfo {
        provider_id: "baidu".to_string(),
        provider_name: r#"{"zh": "百度", "en": "Baidu"}"#.to_string(),
        description: r#"{"zh": "百度工具集合，提供翻译等功能", "en": "Baidu toolset, provides translation and other functions."}"#.to_string(),
        icon: Some("baidu".to_string()),
        credentials_schema: Some(serde_json::json!({
            "BAIDU_APPID": {
                "type": "string",
                "description": "App ID for Baidu service"
            },
            "BAIDU_SECRETKEY": {
                "type": "string",
                "description": "Secret Key for Baidu service"
            }
        })),
        test_input: Some(serde_json::json!({
            "content": "Hello, world!",
            "dest": "zh"
        })),
    }
}
