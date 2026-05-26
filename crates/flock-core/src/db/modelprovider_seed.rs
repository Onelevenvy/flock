use super::ModelProvider;

/// Built-in provider definitions with their supported models.
/// These are seeded into the database on first initialization.
pub fn builtin_providers() -> Vec<(ModelProvider, Vec<ModelSeed>)> {
    vec![
        anthropic(),
        openai(),
        siliconflow(),
        zhipuai(),
        deepseek(),
        ollama(),
        openai_compatible(),
        anthropic_compatible(),
    ]
}

pub struct ModelSeed {
    pub id: &'static str,
    pub model_name: &'static str,
    pub categories: &'static [&'static str],
    pub capabilities: &'static [&'static str],
}

#[derive(serde::Deserialize)]
struct YamlModelProvider {
    id: String,
    provider_name: crate::types::tool::I18nString,
    provider_type: String,
    base_url: Option<String>,
    description: Option<crate::types::tool::I18nString>,
    test_model: Option<String>,
}

fn parse_provider_from_yaml(yaml_str: &str, icon_svg: Option<&str>) -> ModelProvider {
    let parsed: YamlModelProvider = serde_yaml::from_str(yaml_str)
        .unwrap_or_else(|e| panic!("Failed to parse model provider YAML. Error: {}\nYAML:\n{}", e, yaml_str));

    let icon = icon_svg.map(|svg| {
        use base64::{Engine as _, engine::general_purpose};
        format!("data:image/svg+xml;base64,{}", general_purpose::STANDARD.encode(svg))
    });

    ModelProvider {
        id: parsed.id,
        provider_name: parsed.provider_name,
        provider_type: parsed.provider_type,
        base_url: parsed.base_url,
        api_key: None,
        icon,
        description: parsed.description,
        test_model: parsed.test_model,
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn anthropic() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/anthropic/provider.yaml"),
        Some(include_str!("model_providers/anthropic/icon.svg")),
    );
    let models = vec![
        ModelSeed { id: "anthropic:claude-sonnet-4-20250514", model_name: "claude-sonnet-4-20250514", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "anthropic:claude-haiku-4-20250514", model_name: "claude-haiku-4-20250514", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "anthropic:claude-opus-4-20250514", model_name: "claude-opus-4-20250514", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}

fn anthropic_compatible() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/anthropic_compatible/provider.yaml"),
        Some(include_str!("model_providers/anthropic_compatible/icon.svg")),
    );
    (provider, vec![])
}

fn openai() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/openai/provider.yaml"),
        Some(include_str!("model_providers/openai/icon.svg")),
    );
    let models = vec![
        ModelSeed { id: "openai:gpt-4o", model_name: "gpt-4o", categories: &["chat"], capabilities: &["vision"] },
        ModelSeed { id: "openai:gpt-4o-mini", model_name: "gpt-4o-mini", categories: &["chat"], capabilities: &["vision"] },
    ];
    (provider, models)
}

fn openai_compatible() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/openai_compatible/provider.yaml"),
        Some(include_str!("model_providers/openai_compatible/icon.svg")),
    );
    (provider, vec![])
}

fn siliconflow() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/siliconflow/provider.yaml"),
        Some(include_str!("model_providers/siliconflow/icon.svg")),
    );
    let models = vec![
        ModelSeed { id: "siliconflow:Pro/zai-org/GLM-4.7", model_name: "Pro/zai-org/GLM-4.7", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "siliconflow:Pro/deepseek-ai/DeepSeek-V3.2", model_name: "Pro/deepseek-ai/DeepSeek-V3.2", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}

fn zhipuai() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/zhipuai/provider.yaml"),
        Some(include_str!("model_providers/zhipuai/icon.svg")),
    );
    let models = vec![
        ModelSeed { id: "zhipuai:glm-4.7-flash", model_name: "glm-4.7-flash", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}

fn deepseek() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/deepseek/provider.yaml"),
        Some(include_str!("model_providers/deepseek/icon.svg")),
    );
    let models = vec![
        ModelSeed { id: "deepseek:deepseek-chat", model_name: "deepseek-chat", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "deepseek:deepseek-reasoner", model_name: "deepseek-reasoner", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}

fn ollama() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = parse_provider_from_yaml(
        include_str!("model_providers/ollama/provider.yaml"),
        Some(include_str!("model_providers/ollama/icon.svg")),
    );
    let models = vec![
        ModelSeed { id: "ollama:qwen2.5:32b", model_name: "qwen2.5:32b", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "ollama:llama3.1:8b", model_name: "llama3.1:8b", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "ollama:deepseek-r1:8b", model_name: "deepseek-r1:8b", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}
