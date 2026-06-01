use flock_agent::agent_setup::{AgentBuilder, AssistantOverrides};
use flock_agent::sinks::OutputSink;
use flock_core::config::settings::{Config, ProviderType, ToolsConfig, SessionConfig, McpConfig, SandboxConfig};
use flock_core::config::DebugConfig;
use flock_core::db::DbManager;
use std::sync::Arc;
use std::path::PathBuf;

fn create_test_config(base_url: String, db_path: PathBuf, db_manager: Arc<DbManager>) -> Config {
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
        debug: DebugConfig::default(),
        db_path,
        db_manager: Some(db_manager),
    }
}

struct DebugSink;
impl OutputSink for DebugSink {
    fn emit_text_delta(&self, text: &str, _msg_id: &str) {
        println!("[DEBUG_SINK][text_delta] {}", text);
    }
    fn emit_thinking(&self, text: &str, _msg_id: &str) {
        println!("[DEBUG_SINK][thinking] {}", text);
    }
    fn emit_tool_call(&self, name: &str, input: &str) {
        println!("[DEBUG_SINK][tool_call] {}({})", name, input);
    }
    fn emit_tool_result(&self, name: &str, is_error: bool, content: &str) {
        println!("[DEBUG_SINK][tool_result] {} error={} content={}", name, is_error, content);
    }
    fn emit_stream_start(&self, _msg_id: &str) {}
    fn emit_stream_end(&self, _msg_id: &str, _turns: usize, _in_t: u64, _out_t: u64, _c_c: u64, _c_r: u64) {}
    fn emit_error(&self, msg: &str) {
        println!("[DEBUG_SINK][error] {}", msg);
    }
    fn emit_info(&self, msg: &str) {
        println!("[DEBUG_SINK][info] {}", msg);
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn test_agent_dialogue_mock() {
    let mock_server = wiremock::MockServer::start().await;
    
    // 使用标准的 \r\n 结尾的 SSE 报文
    let mock_stream = "data: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Hello, I am a mock AI assistant!\"},\"finish_reason\":null}]}\r\n\r\ndata: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\r\n\r\ndata: [DONE]\r\n\r\n";
    
    wiremock::Mock::given(wiremock::matchers::any())
        .respond_with(wiremock::ResponseTemplate::new(200)
            .set_body_raw(mock_stream.as_bytes().to_vec(), "text/event-stream"))
        .mount(&mock_server)
        .await;

    let temp_dir = tempfile::tempdir().unwrap();
    let db_file_path = temp_dir.path().join("test_agent_dialogue.db");
    let db_manager = Arc::new(DbManager::init_at(db_file_path.clone()).await.unwrap());

    // base_url 加上 /v1 尾缀
    let config = create_test_config(format!("{}/v1", mock_server.uri()), db_file_path, db_manager);
    let workspace = tempfile::tempdir().unwrap();
    let output = Arc::new(DebugSink);
    
    let build_result = AgentBuilder::new(config, workspace.path().to_string_lossy(), output)
        .build()
        .await
        .unwrap();
        
    let mut engine = build_result.engine;
    engine.init_session("openai", &workspace.path().to_string_lossy(), Some("dialogue-session-id")).await.unwrap();
    
    let response = engine.run("Hello", "msg-1").await.unwrap().text;

    // 打印 mock server 实际接收到的请求记录
    let reqs = mock_server.received_requests().await;
    println!("DEBUG: Received requests: {:?}", reqs);

    assert_eq!(response, "Hello, I am a mock AI assistant!");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_agent_concurrency_isolation() {
    let mock_server = wiremock::MockServer::start().await;

    struct ConcurrencyResponder;
    impl wiremock::Respond for ConcurrencyResponder {
        fn respond(&self, request: &wiremock::Request) -> wiremock::ResponseTemplate {
            let body: serde_json::Value = serde_json::from_slice(&request.body).unwrap();
            let prompt = body["messages"]
                .as_array()
                .and_then(|arr| arr.last())
                .and_then(|msg| msg["content"].as_str())
                .unwrap_or("");
            // 提取 prompt 里的 UUID
            let uuid = prompt.split("UUID:").last().unwrap_or("").trim();
            
            let mock_stream = format!(
                "data: {{\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{{\"index\":0,\"delta\":{{\"role\":\"assistant\",\"content\":\"Response for UUID: {}\"}},\"finish_reason\":null}}]}}\r\n\r\ndata: {{\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{{\"index\":0,\"delta\":{{}},\"finish_reason\":\"stop\"}}]}}\r\n\r\ndata: [DONE]\r\n\r\n",
                uuid
            );
            
            wiremock::ResponseTemplate::new(200)
                .set_body_raw(mock_stream.as_bytes().to_vec(), "text/event-stream")
        }
    }

    wiremock::Mock::given(wiremock::matchers::any())
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
            let temp_dir = tempfile::tempdir().unwrap();
            let db_file_path = temp_dir.path().join(format!("test_agent_concurrency_{}.db", i));
            let db_manager = Arc::new(DbManager::init_at(db_file_path.clone()).await.unwrap());

            // base_url 加上 /v1 尾缀
            let config = create_test_config(format!("{}/v1", base_url_clone), db_file_path, db_manager);
            let workspace = tempfile::tempdir().unwrap();
            let output = Arc::new(DebugSink);
            
            let build_result = AgentBuilder::new(config, workspace.path().to_string_lossy(), output)
                .build()
                .await
                .unwrap();
                
            let mut engine = build_result.engine;
            engine.init_session("openai", &workspace.path().to_string_lossy(), Some(&uuid_clone)).await.unwrap();
            
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
