use super::ModelProvider;

/// Built-in provider definitions with their supported models.
/// These are seeded into the database on first initialization.
pub fn builtin_providers() -> Vec<(ModelProvider, Vec<ModelSeed>)> {
    vec![
        super::model_providers::anthropic::seed_data(),
        super::model_providers::openai::seed_data(),
        super::model_providers::siliconflow::seed_data(),
        super::model_providers::zhipuai::seed_data(),
        super::model_providers::deepseek::seed_data(),
        super::model_providers::ollama::seed_data(),
        super::model_providers::openai_compatible::seed_data(),
        super::model_providers::anthropic_compatible::seed_data(),
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

pub fn parse_provider_from_yaml(yaml_str: &str, icon_svg: Option<&str>) -> (ModelProvider, Vec<ModelSeed>) {
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
