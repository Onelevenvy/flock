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

#[derive(Clone)]
pub struct ModelSeed {
    pub id: String,
    pub model_name: String,
    pub categories: Vec<String>,
    pub capabilities: Vec<String>,
}

#[derive(serde::Deserialize)]
struct YamlModelProvider {
    id: String,
    provider_name: crate::types::tool::I18nString,
    provider_type: String,
    base_url: Option<String>,
    description: Option<crate::types::tool::I18nString>,
    test_model: Option<String>,
    #[serde(default)]
    models: Vec<YamlModelSeed>,
}

#[derive(serde::Deserialize)]
struct YamlModelSeed {
    id: String,
    model_name: String,
    #[serde(default)]
    categories: Vec<String>,
    #[serde(default)]
    capabilities: Vec<String>,
}

fn parse_provider_from_yaml(yaml_str: &str, icon_svg: Option<&str>) -> (ModelProvider, Vec<ModelSeed>) {
    let parsed: YamlModelProvider = serde_yaml::from_str(yaml_str)
        .unwrap_or_else(|e| panic!("Failed to parse model provider YAML. Error: {}\nYAML:\n{}", e, yaml_str));

    let icon = icon_svg.map(|svg| {
        use base64::{Engine as _, engine::general_purpose};
        format!("data:image/svg+xml;base64,{}", general_purpose::STANDARD.encode(svg))
    });

    let provider = ModelProvider {
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
    };

    let seeds = parsed.models.into_iter().map(|m| ModelSeed {
        id: m.id,
        model_name: m.model_name,
        categories: m.categories,
        capabilities: m.capabilities,
    }).collect();

    (provider, seeds)
}

fn anthropic() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/anthropic/provider.yaml"),
        Some(include_str!("model_providers/anthropic/icon.svg")),
    )
}

fn anthropic_compatible() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/anthropic_compatible/provider.yaml"),
        Some(include_str!("model_providers/anthropic_compatible/icon.svg")),
    )
}

fn openai() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/openai/provider.yaml"),
        Some(include_str!("model_providers/openai/icon.svg")),
    )
}

fn openai_compatible() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/openai_compatible/provider.yaml"),
        Some(include_str!("model_providers/openai_compatible/icon.svg")),
    )
}

fn siliconflow() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/siliconflow/provider.yaml"),
        Some(include_str!("model_providers/siliconflow/icon.svg")),
    )
}

fn zhipuai() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/zhipuai/provider.yaml"),
        Some(include_str!("model_providers/zhipuai/icon.svg")),
    )
}

fn deepseek() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/deepseek/provider.yaml"),
        Some(include_str!("model_providers/deepseek/icon.svg")),
    )
}

fn ollama() -> (ModelProvider, Vec<ModelSeed>) {
    parse_provider_from_yaml(
        include_str!("model_providers/ollama/provider.yaml"),
        Some(include_str!("model_providers/ollama/icon.svg")),
    )
}
