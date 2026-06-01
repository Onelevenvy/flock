use flock_agent::agent_setup::{AgentBuilder, AssistantOverrides};
use flock_agent::sinks::null_sink::NullSink;
use flock_core::config::settings::{Config, ProviderType, ToolsConfig, SessionConfig, McpConfig, SandboxConfig};
use std::sync::Arc;
use std::path::PathBuf;

fn create_test_config(base_url: String) -> Config {
    Config {
        provider_label: "openai".to_string(),
        provider: ProviderType::OpenAI,
        api_key: "mock-key".to_string(),
        base_url,
        model: "gpt-4o".to_string(),
        max_tokens: 1000,
        max_turns: Some(5),
        system_prompt: None,
        thinking: None,
        prompt_caching: false,
        compat: flock_core::config::compat::ProviderCompat::openai_defaults(),
        tools: ToolsConfig::default(),
        session: SessionConfig::default(),
        compact: flock_core::config::compression::CompressionConfig::default(),
        plan: flock_core::config::plan::PlanConfig::default(),
        file_cache: flock_core::config::file_cache::FileCacheConfig::default(),
        hooks: flock_core::config::hooks::HooksConfig::default(),
        bedrock: None,
        vertex: None,
        mcp: McpConfig::default(),
        sandbox: SandboxConfig::default(),
        debug: flock_core::config::debug::DebugConfig::default(),
        db_path: PathBuf::from("mock_db_path"),
        db_manager: None,
    }
}

#[tokio::test]
async fn test_agent_dialogue_mock() {
    let mock_server = wiremock::MockServer::start().await;
    
    // Mock 响应
    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/v1/chat/completions"))
        .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677858242,
            "model": "gpt-4o",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello, I am a mock AI assistant!"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 9,
                "completion_tokens": 12,
                "total_tokens": 21
            }
        })))
        .mount(&mock_server)
        .await;

    let config = create_test_config(mock_server.uri());
    let workspace = tempfile::tempdir().unwrap();
    let output = Arc::new(NullSink);
    
    let build_result = AgentBuilder::new(config, workspace.path().to_string_lossy(), output)
        .build()
        .await
        .unwrap();
        
    let mut engine = build_result.engine;
    engine.init_session("openai", &workspace.path().to_string_lossy(), None).await.unwrap();
    
    let response = engine.run("Hello", "msg-1").await.unwrap().text;
    assert_eq!(response, "Hello, I am a mock AI assistant!");
}

#[tokio::test]
async fn test_agent_concurrency_isolation() {
    let mock_server = wiremock::MockServer::start().await;

    struct ConcurrencyResponder;
    impl wiremock::Respond for ConcurrencyResponder {
        fn respond(&self, request: &wiremock::Request) -> wiremock::ResponseTemplate {
            let body: serde_json::Value = serde_json::from_slice(&request.body).unwrap();
            let prompt = body["messages"][0]["content"].as_str().unwrap_or("");
            // 提取 prompt 里的 UUID
            let uuid = prompt.split("UUID:").last().unwrap_or("").trim();
            
            wiremock::ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "id": "chatcmpl-123",
                "object": "chat.completion",
                "created": 1677858242,
                "model": "gpt-4o",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": format!("Response for UUID: {}", uuid)
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 9,
                    "completion_tokens": 12,
                    "total_tokens": 21
                }
            }))
        }
    }

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/v1/chat/completions"))
        .respond_with(ConcurrencyResponder)
        .mount(&mock_server)
        .await;

    let base_url = mock_server.uri();
    let mut tasks = Vec::new();

    // 并发启动 10 个 Agent 会话
    for i in 0..10 {
        let base_url_clone = base_url.clone();
        let uuid = format!("agent-session-uuid-{}", i);
        let uuid_clone = uuid.clone();
        
        let handle = tokio::spawn(async move {
            let config = create_test_config(base_url_clone);
            let workspace = tempfile::tempdir().unwrap();
            let output = Arc::new(NullSink);
            
            let build_result = AgentBuilder::new(config, workspace.path().to_string_lossy(), output)
                .build()
                .await
                .unwrap();
                
            let mut engine = build_result.engine;
            engine.init_session("openai", &workspace.path().to_string_lossy(), None).await.unwrap();
            
            let prompt = format!("Hello, my UUID: {}", uuid_clone);
            let response = engine.run(&prompt, &uuid_clone).await.unwrap().text;
            
            (uuid_clone, response)
        });
        tasks.push(handle);
    }

    for task in tasks {
        let (uuid, response) = task.await.unwrap();
        // 确保响应与其会话特有的 UUID 严格对应，保证数据没有交叉污染
        assert_eq!(response, format!("Response for UUID: {}", uuid));
    }
}
