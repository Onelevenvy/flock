use std::sync::Arc;
use std::collections::HashMap;
use serde_json::json;
use flock_workflow::builder::build_workflow_graph;
use flock_workflow::nodes::{WorkflowNodeContext, WorkflowSink};
use flock_core::config::settings::ProviderType;
use flock_core::model_factory::{create_model, ModelProviderParams};
use flock_tools::registry::ToolRegistry;
use flock_core::db::DbManager;
use langgraph_checkpoint::checkpoint::memory::InMemorySaver;
use langgraph::prelude::*;

struct MockWorkflowSink;
impl WorkflowSink for MockWorkflowSink {
    fn emit_node_start(&self, _node_id: &str) {}
    fn emit_node_done(&self, _node_id: &str, _output: &serde_json::Value) {}
    fn emit_text_delta(&self, _node_id: &str, _text: &str) {}
    fn emit_thinking(&self, _node_id: &str, _text: &str) {}
    fn emit_error(&self, _msg: &str) {}
}

#[tokio::test(flavor = "multi_thread")]
async fn test_workflow_start_and_llm_nodes() {
    let mock_server = wiremock::MockServer::start().await;
    
    let mock_stream = "data: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Workflow processed message successfully!\"},\"finish_reason\":null}]}\r\n\r\ndata: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\r\n\r\ndata: [DONE]\r\n\r\n";

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/v1/chat/completions"))
        .respond_with(wiremock::ResponseTemplate::new(200)
            .set_body_raw(mock_stream.as_bytes().to_vec(), "text/event-stream"))
        .mount(&mock_server)
        .await;

    let provider = Arc::from(create_model(ModelProviderParams {
        provider_type: "openai".to_string(),
        model: "gpt-4o".to_string(),
        api_key: "mock-key".to_string(),
        base_url: Some(format!("{}/v1", mock_server.uri())),
        max_tokens: None,
        temperature: None,
        top_p: None,
        frequency_penalty: None,
        presence_penalty: None,
        response_format: None,
    }).unwrap());

    // 使用临时目录代替内存数据库（避免原 init_in_memory 缺失的问题）
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_workflow.db");
    let db = Arc::new(DbManager::init_at(db_path).await.unwrap());
    
    let ctx = Arc::new(WorkflowNodeContext {
        provider,
        model_factory: Arc::new(flock_core::model_factory::CachedModelFactory::new(
            HashMap::new(),
            "openai".to_string(),
            "mock-key".to_string(),
            Some(format!("{}/v1", mock_server.uri())),
        )),
        tools: Arc::new(ToolRegistry::new()),
        db,
        sink: Arc::new(MockWorkflowSink),
        debug_mode: false,
        env_vars: HashMap::new(),
        workflow_id: "test-workflow-1".to_string(),
        approval_manager: Arc::new(flock_core::ipc_interface::approval::ToolApprovalManager::new()),
    });

    let workflow_config = json!({
        "nodes": [
            {
                "id": "start_1",
                "type": "start",
                "data": {}
            },
            {
                "id": "llm_1",
                "type": "llm",
                "data": {
                    "userMessage": "Say hello to: ${sys.query}",
                    "output_var": "greeting"
                }
            },
            {
                "id": "end_1",
                "type": "end",
                "data": {}
            }
        ],
        "edges": [
            {
                "source": "start_1",
                "target": "llm_1"
            },
            {
                "source": "llm_1",
                "target": "end_1"
            }
        ]
    });

    let checkpointer = Arc::new(InMemorySaver::new());
    let graph = build_workflow_graph(&workflow_config, ctx, checkpointer).unwrap();

    let initial_state = json!({
        "input_msg": "Flock Developer",
        "messages": [],
        "node_outputs": {},
        "current_node": "",
        "quit_requested": false,
        "env_vars": {}
    });

    let mut run_config = RunnableConfig::default();
    run_config.insert("configurable".to_string(), serde_json::json!({ "thread_id": "thread-1" }));
    let final_state = graph.ainvoke(&initial_state, &run_config).await.unwrap();

    let node_outputs = final_state.get("node_outputs").unwrap();
    let llm_output = node_outputs.get("llm_1").unwrap();
    assert_eq!(llm_output.get("response").unwrap().as_str().unwrap(), "Workflow processed message successfully!");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_workflow_concurrency_isolation() {
    let mock_server = wiremock::MockServer::start().await;

    struct WorkflowResponder;
    impl wiremock::Respond for WorkflowResponder {
        fn respond(&self, request: &wiremock::Request) -> wiremock::ResponseTemplate {
            let body: serde_json::Value = serde_json::from_slice(&request.body).unwrap();
            let messages = body["messages"].as_array().unwrap();
            let prompt = messages.last().and_then(|m| m["content"].as_str()).unwrap_or("");
            let uuid = prompt.split("hello to:").last().unwrap_or("").trim();
            let mock_stream = format!(
                "data: {{\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{{\"index\":0,\"delta\":{{\"role\":\"assistant\",\"content\":\"Response for workflow UUID: {}\"}},\"finish_reason\":null}}]}}\r\n\r\ndata: {{\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677858242,\"model\":\"gpt-4o\",\"choices\":[{{\"index\":0,\"delta\":{{}},\"finish_reason\":\"stop\"}}]}}\r\n\r\ndata: [DONE]\r\n\r\n",
                uuid
            );
            wiremock::ResponseTemplate::new(200)
                .set_body_raw(mock_stream.as_bytes().to_vec(), "text/event-stream")
        }
    }

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/v1/chat/completions"))
        .respond_with(WorkflowResponder)
        .mount(&mock_server)
        .await;

    let base_url = mock_server.uri();
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("test_concurrency_workflow.db");
    let db = Arc::new(DbManager::init_at(db_path).await.unwrap());
    let checkpointer = Arc::new(InMemorySaver::new());

    let mut tasks = Vec::new();
    for i in 0..5 {
        let base_url_clone = base_url.clone();
        let db_clone = db.clone();
        let checkpointer_clone = checkpointer.clone();
        let uuid = format!("workflow-uuid-{}", i);
        let uuid_clone = uuid.clone();

        let handle = tokio::spawn(async move {
            let provider = Arc::from(create_model(ModelProviderParams {
                provider_type: "openai".to_string(),
                model: "gpt-4o".to_string(),
                api_key: "mock-key".to_string(),
                base_url: Some(format!("{}/v1", base_url_clone.clone())),
                max_tokens: None,
                temperature: None,
                top_p: None,
                frequency_penalty: None,
                presence_penalty: None,
                response_format: None,
            }).unwrap());

            let ctx = Arc::new(WorkflowNodeContext {
                provider,
                model_factory: Arc::new(flock_core::model_factory::CachedModelFactory::new(
                    HashMap::new(),
                    "openai".to_string(),
                    "mock-key".to_string(),
                    Some(format!("{}/v1", base_url_clone)),
                )),
                tools: Arc::new(ToolRegistry::new()),
                db: db_clone,
                sink: Arc::new(MockWorkflowSink),
                debug_mode: false,
                env_vars: HashMap::new(),
                workflow_id: format!("wf-{}", uuid_clone),
                approval_manager: Arc::new(flock_core::ipc_interface::approval::ToolApprovalManager::new()),
            });

            let workflow_config = json!({
                "nodes": [
                    { "id": "start_1", "type": "start", "data": {} },
                    {
                        "id": "llm_1",
                        "type": "llm",
                        "data": {
                            "userMessage": "Say hello to: ${sys.query}",
                            "output_var": "greeting"
                        }
                    },
                    { "id": "end_1", "type": "end", "data": {} }
                ],
                "edges": [
                    { "source": "start_1", "target": "llm_1" },
                    { "source": "llm_1", "target": "end_1" }
                ]
            });

            let graph = build_workflow_graph(&workflow_config, ctx, checkpointer_clone).unwrap();
            let initial_state = json!({
                "input_msg": uuid_clone,
                "messages": [],
                "node_outputs": {},
                "current_node": "",
                "quit_requested": false,
                "env_vars": {}
            });

            let mut run_config = RunnableConfig::default();
            run_config.insert("configurable".to_string(), serde_json::json!({ "thread_id": format!("thread-wf-{}", uuid_clone) }));
            let final_state = graph.ainvoke(&initial_state, &run_config).await.unwrap();
            
            let node_outputs = final_state.get("node_outputs").unwrap();
            let llm_output = node_outputs.get("llm_1").unwrap();
            let greeting = llm_output.get("response").unwrap().as_str().unwrap().to_string();
            
            (uuid_clone, greeting)
        });
        tasks.push(handle);
    }

    for task in tasks {
        let (uuid, greeting) = task.await.unwrap();
        assert_eq!(greeting, format!("Response for workflow UUID: {}", uuid));
    }
}
