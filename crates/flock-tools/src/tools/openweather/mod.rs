use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{ProviderInfo, I18nString};
use langgraph_derive::tool;
use serde_json::Value;

/// Queries weather information for a city using the OpenWeather API.
///
/// @param city The city name in English (e.g. "Beijing", "New York", "London"). Must use English to avoid API errors.
#[tool("Open Weather")]
pub async fn open_weather(city: String) -> Result<String, String> {
    let creds_json = crate::resolve_provider_credentials("openweather")
        .await
        .unwrap_or_default();
    let api_key = serde_json::from_str::<serde_json::Value>(&creds_json)
        .ok()
        .and_then(|v| v.get("OPEN_WEATHER_API_KEY")?.get("value")?.as_str().map(String::from))
        .unwrap_or_default();

    if api_key.is_empty() {
        return Err(
            "OpenWeather API Key is not set. Please authorize in the Plugins page."
                .to_string(),
        );
    }

    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.openweathermap.org/data/2.5/weather")
        .query(&[
            ("q", city.as_str()),
            ("appid", api_key.as_str()),
            ("units", "metric"),
            ("lang", "zh_cn"),
        ])
        .send()
        .await
        .map_err(|e| format!("OpenWeather API request failed: {}", e))?;

    if resp.status().is_success() {
        let data: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Failed to serialize response: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!(
            "Failed with status code {}: {}",
            status.as_u16(),
            text
        ))
    }
}

pub struct OpenWeatherTool;
impl OpenWeatherTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(OpenWeather, ToolCategory::Exec)
                .with_provider_id("openweather")
                .with_provider_name("Open Weather"),
        )
    }
}

pub fn provider_info() -> ProviderInfo {
    crate::parse_provider_info_from_yaml(
        include_str!("provider.yaml"),
        Some(include_str!("icon.svg")),
    )
}

