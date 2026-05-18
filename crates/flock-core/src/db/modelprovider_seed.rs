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

fn anthropic() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "anthropic".into(),
        provider_name: "anthropic".into(),
        provider_type: "anthropic".into(),
        base_url: Some("https://api.anthropic.com".into()),
        api_key: None,
        icon: Some("anthropic".into()),
        description: Some("Anthropic Claude models".into()),
        test_model: Some("claude-haiku-4-20250514".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "anthropic:claude-sonnet-4-20250514", model_name: "claude-sonnet-4-20250514", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "anthropic:claude-haiku-4-20250514", model_name: "claude-haiku-4-20250514", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "anthropic:claude-opus-4-20250514", model_name: "claude-opus-4-20250514", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}

fn anthropic_compatible() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "anthropic_compatible".into(),
        provider_name: "anthropic_compatible".into(),
        provider_type: "anthropic".into(),
        base_url: Some("https://token-plan-cn.xiaomimimo.com/anthropic".into()),
        api_key: None,
        icon: Some("anthropic_compatible".into()),
        description: Some("Anthropic Compatible models".into()),
        test_model: Some("mimo-v2.5-pro".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "anthropic_compatible:mimo-v2.5-pro", model_name: "mimo-v2.5-pro", categories: &["chat"], capabilities: &["vision"] },

    ];
    (provider, models)
}
fn openai() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "openai".into(),
        provider_name: "openai".into(),
        provider_type: "openai".into(),
        base_url: Some("https://api.openai.com/v1".into()),
        api_key: None,
        icon: Some("openai".into()),
        description: Some("OpenAI GPT models".into()),
        test_model: Some("gpt-4o-mini".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "openai:gpt-4o", model_name: "gpt-4o", categories: &["chat"], capabilities: &["vision"] },
        ModelSeed { id: "openai:gpt-4o-mini", model_name: "gpt-4o-mini", categories: &["chat"], capabilities: &["vision"] },
    ];
    (provider, models)
}

fn openai_compatible() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "openai_compatible".into(),
        provider_name: "openai_compatible".into(),
        provider_type: "openai".into(),
        base_url: Some("https://token-plan-cn.xiaomimimo.com/v1".into()),
        api_key: None,
        icon: Some("openai_compatible".into()),
        description: Some("OpenAI Compatible models".into()),
        test_model: Some("mimo-v2.5-pro".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "openai_compatible:mimo-v2.5-pro", model_name: "mimo-v2.5-pro", categories: &["chat"], capabilities: &["vision"] },
    ];
    (provider, models)
}

fn siliconflow() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "siliconflow".into(),
        provider_name: "siliconflow".into(),
        provider_type: "openai".into(),
        base_url: Some("https://api.siliconflow.cn/v1".into()),
        api_key: None,
        icon: Some("siliconflow".into()),
        description: Some("SiliconFlow models".into()),
        test_model: Some("Pro/zai-org/GLM-4.7".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
    
        ModelSeed { id: "siliconflow:Pro/zai-org/GLM-4.7", model_name: "Pro/zai-org/GLM-4.7", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "siliconflow:Pro/deepseek-ai/DeepSeek-V3.2", model_name: "Pro/deepseek-ai/DeepSeek-V3.2", categories: &["chat"], capabilities: &[] },
    ];
       
    (provider, models)
}

fn zhipuai() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "zhipuai".into(),
        provider_name: "zhipuai".into(),
        provider_type: "openai".into(),
        base_url: Some("https://open.bigmodel.cn/api/paas/v4".into()),
        api_key: None,
        icon: Some("zhipuai".into()),
        description: Some("ZhipuAI GLM models".into()),
        test_model: Some("glm-4.7-flash".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "zhipuai:glm-4.7-flash", model_name: "glm-4.7-flash", categories: &["chat"], capabilities: &[] },

    ];
    (provider, models)
}

fn deepseek() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "deepseek".into(),
        provider_name: "deepseek".into(),
        provider_type: "openai".into(),
        base_url: Some("https://api.deepseek.com".into()),
        api_key: None,
        icon: Some("deepseek".into()),
        description: Some("DeepSeek models".into()),
        test_model: Some("deepseek-chat".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "deepseek:deepseek-chat", model_name: "deepseek-chat", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "deepseek:deepseek-reasoner", model_name: "deepseek-reasoner", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}

fn ollama() -> (ModelProvider, Vec<ModelSeed>) {
    let provider = ModelProvider {
        id: "ollama".into(),
        provider_name: "ollama".into(),
        provider_type: "openai".into(),
        base_url: Some("http://localhost:11434".into()),
        api_key: None,
        icon: Some("ollama".into()),
        description: Some("Ollama local models".into()),
        test_model: Some("llama3.1:8b".into()),
        is_available: false,
        created_at: String::new(),
        updated_at: String::new(),
    };
    let models = vec![
        ModelSeed { id: "ollama:qwen2.5:32b", model_name: "qwen2.5:32b", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "ollama:llama3.1:8b", model_name: "llama3.1:8b", categories: &["chat"], capabilities: &[] },
        ModelSeed { id: "ollama:deepseek-r1:8b", model_name: "deepseek-r1:8b", categories: &["chat"], capabilities: &[] },
    ];
    (provider, models)
}
