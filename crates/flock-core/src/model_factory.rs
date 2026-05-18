use langgraph_prebuilt::BaseChatModel;
use langgraph_providers::openai::{OpenAIModel, OpenAIModelConfig};
use langgraph_providers::anthropic::{AnthropicModel, AnthropicModelConfig};

/// Parameters for creating a model provider.
pub struct ModelProviderParams {
    pub provider_type: String,
    pub model: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub max_tokens: Option<u32>,
}

/// Create a `BaseChatModel` implementation based on provider type.
///
/// - `"anthropic"` → `AnthropicModel`
/// - everything else → `OpenAIModel` (covers openai, deepseek, ollama, etc.)
pub fn create_model(params: ModelProviderParams) -> Result<Box<dyn BaseChatModel>, String> {
    match params.provider_type.as_str() {
        "anthropic" => {
            let mut cfg = AnthropicModelConfig {
                model: params.model,
                api_key: params.api_key,
                api_base: params.base_url,
                ..Default::default()
            };
            if let Some(mt) = params.max_tokens {
                cfg.max_tokens = mt;
            }
            Ok(Box::new(AnthropicModel::new(cfg)))
        }
        "openai" => {
            Ok(Box::new(OpenAIModel::new(OpenAIModelConfig {
                model: params.model,
                api_key: params.api_key,
                api_base: params.base_url,
                ..Default::default()
            })))
        }
        other => Err(format!("不支持的 provider 类型: '{}'，请先实现对应模型", other)),
    }
}
