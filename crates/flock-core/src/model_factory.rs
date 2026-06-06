use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use serde_json::json;
use langgraph::prebuilt::BaseChatModel;
use langgraph::providers::openai::{OpenAIModel, OpenAIModelConfig};
use langgraph::providers::anthropic::{AnthropicModel, AnthropicModelConfig};

/// Parameters for creating a model provider.
pub struct ModelProviderParams {
    pub provider_type: String,
    pub model: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
    pub response_format: Option<serde_json::Value>,
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
            cfg.temperature = params.temperature;
            cfg.top_p = params.top_p;
            Ok(Box::new(AnthropicModel::new(cfg)))
        }
        "openai" => {
            Ok(Box::new(OpenAIModel::new(OpenAIModelConfig {
                model: params.model,
                api_key: params.api_key,
                api_base: params.base_url,
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                top_p: params.top_p,
                frequency_penalty: params.frequency_penalty,
                presence_penalty: params.presence_penalty,
                response_format: params.response_format,
            })))
        }
        other => Err(format!("不支持的 provider 类型: '{}'，请先实现对应模型", other)),
    }
}

/// Trait for creating model instances by model name.
/// Used by workflow nodes to support per-node model selection.
pub trait ModelFactory: Send + Sync {
    /// Create a model instance for the given model name.
    /// Falls back to the default provider if the model is not found.
    fn create(&self, model_name: &str) -> Result<Arc<dyn BaseChatModel>, String>;

    /// Create a model instance with per-node LLM parameter overrides.
    fn create_with_params(
        &self,
        model_name: &str,
        params: ModelLlmParams,
    ) -> Result<Arc<dyn BaseChatModel>, String>;
}

/// Per-node LLM parameter overrides (temperature, top_p, json_mode, etc.).
#[derive(Debug, Clone, Default)]
pub struct ModelLlmParams {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
    pub max_tokens: Option<u32>,
    pub json_mode: bool,
    pub json_schema: Option<serde_json::Value>,
}

impl ModelLlmParams {
    /// Returns true if any non-default parameter is set.
    pub fn has_custom_params(&self) -> bool {
        self.temperature.is_some()
            || self.top_p.is_some()
            || self.frequency_penalty.is_some()
            || self.presence_penalty.is_some()
            || self.max_tokens.is_some()
            || self.json_mode
    }

    /// Build the `response_format` value for OpenAI-compatible APIs.
    pub fn build_response_format(&self) -> Option<serde_json::Value> {
        if !self.json_mode {
            return None;
        }
        if let Some(schema) = &self.json_schema {
            Some(json!({
                "type": "json_schema",
                "json_schema": schema
            }))
        } else {
            Some(json!({ "type": "json_object" }))
        }
    }
}

/// Cached model factory that looks up provider info from a pre-loaded registry.
/// Thread-safe via RwLock on the cache.
pub struct CachedModelFactory {
    /// model_name -> (provider_type, api_key, base_url)
    registry: HashMap<String, (String, String, Option<String>)>,
    /// Default provider params, used as fallback when model_name is not in registry
    default_provider_type: String,
    default_api_key: String,
    default_base_url: Option<String>,
    /// Cache of created models: model_name -> Arc<dyn BaseChatModel>
    cache: RwLock<HashMap<String, Arc<dyn BaseChatModel>>>,
}

impl CachedModelFactory {
    pub fn new(
        registry: HashMap<String, (String, String, Option<String>)>,
        default_provider_type: String,
        default_api_key: String,
        default_base_url: Option<String>,
    ) -> Self {
        Self {
            registry,
            default_provider_type,
            default_api_key,
            default_base_url,
            cache: RwLock::new(HashMap::new()),
        }
    }

    fn create_uncached(&self, model_name: &str, llm_params: &ModelLlmParams) -> Result<Box<dyn BaseChatModel>, String> {
        let (provider_type, api_key, base_url) = if let Some(info) = self.registry.get(model_name) {
            info.clone()
        } else {
            (
                self.default_provider_type.clone(),
                self.default_api_key.clone(),
                self.default_base_url.clone(),
            )
        };

        create_model(ModelProviderParams {
            provider_type,
            model: model_name.to_string(),
            api_key,
            base_url,
            max_tokens: llm_params.max_tokens,
            temperature: llm_params.temperature,
            top_p: llm_params.top_p,
            frequency_penalty: llm_params.frequency_penalty,
            presence_penalty: llm_params.presence_penalty,
            response_format: llm_params.build_response_format(),
        })
    }
}

impl ModelFactory for CachedModelFactory {
    fn create(&self, model_name: &str) -> Result<Arc<dyn BaseChatModel>, String> {
        // Check cache first
        {
            let cache = self.cache.read().unwrap();
            if let Some(model) = cache.get(model_name) {
                return Ok(model.clone());
            }
        }

        let model = self.create_uncached(model_name, &ModelLlmParams::default())?;
        let model: Arc<dyn BaseChatModel> = Arc::from(model);

        // Cache the result
        {
            let mut cache = self.cache.write().unwrap();
            cache.insert(model_name.to_string(), model.clone());
        }

        Ok(model)
    }

    fn create_with_params(
        &self,
        model_name: &str,
        params: ModelLlmParams,
    ) -> Result<Arc<dyn BaseChatModel>, String> {
        if !params.has_custom_params() {
            return self.create(model_name);
        }

        let model = self.create_uncached(model_name, &params)?;
        Ok(Arc::from(model))
    }
}
