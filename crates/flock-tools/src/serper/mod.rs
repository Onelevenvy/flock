use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::ProviderInfo;
use langgraph_derive::tool;
use serde_json::Value;

/// Search the internet using Serper API.
///
/// @param search_query Search query to search the internet
#[tool("Serper Search")]
pub async fn serper_search(search_query: String) -> Result<String, String> {
    let creds_json = crate::resolve_provider_credentials("serper")
        .await
        .unwrap_or_default();
    
    let creds: Value = serde_json::from_str(&creds_json).unwrap_or_default();
    
    let api_key = creds.get("SERPER_API_KEY")
        .and_then(|v| v.get("value"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_default();

    if api_key.is_empty() {
        return Err("Serper API Key is not set. Please authorize in the Plugins page.".to_string());
    }

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "q": search_query,
        "num": 10
    });
    
    let resp = client
        .post("https://google.serper.dev/search")
        .header("X-API-KEY", api_key)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Serper API request failed: {}", e))?;

    if resp.status().is_success() {
        let data: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
            
        if let Some(organic) = data.get("organic").and_then(|v| v.as_array()) {
            let mut results = Vec::new();
            for item in organic.iter().take(10) {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or_default();
                let link = item.get("link").and_then(|v| v.as_str()).unwrap_or_default();
                let snippet = item.get("snippet").and_then(|v| v.as_str()).unwrap_or_default();
                results.push(format!("Title: {}\nLink: {}\nSnippet: {}\n---", title, link, snippet));
            }
            return Ok(results.join("\n"));
        }
        
        Ok(serde_json::to_string_pretty(&data).unwrap_or_default())
    } else {
        Err(format!("Failed with status code: {}", resp.status()))
    }
}

pub struct SerperTool;
impl SerperTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(SerperSearch, ToolCategory::Exec)
                .with_provider_id("serper")
                .with_provider_name("Serper Search"),
        )
    }
}

pub fn provider_info() -> ProviderInfo {
    ProviderInfo {
        provider_id: "serper".to_string(),
        provider_name: r#"{"zh": "Serper", "en": "Serper"}"#.to_string(),
        description: r#"{"zh": "Serper提供的工具，支持全球的搜索", "en": "Serper tool for global internet search."}"#.to_string(),
        icon: Some("serper".to_string()),
        credentials_schema: Some(serde_json::json!({
            "SERPER_API_KEY": {
                "type": "string",
                "description": "API key for Serper service, you can get it from https://serper.dev/"
            }
        })),
        test_input: Some(serde_json::json!({
            "search_query": "What is the latest news of China?"
        })),
    }
}
