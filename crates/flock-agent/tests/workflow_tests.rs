use std::sync::Arc;
use std::collections::HashMap;
use serde_json::json;
use flock_workflow::builder::build_workflow_graph;
use flock_workflow::nodes::{WorkflowNodeContext, WorkflowSink};
use flock_core::config::settings::types::ProviderType;
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

#[tokio::test]
async fn test_workflow_start_and_llm_nodes() {
    let mock_server = wiremock::MockServer::start().await;
    
    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/v1/chat/completions"))
        .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "Workflow processed message successfully!"
                }
            }]
        })))
        .mount(&mock_server)
        .await;

    let provider = Arc::from(create_model(ModelProviderParams {
        provider_type: "openai".to_string(),
        model: "gpt-4o".to_string(),
        api_key: "mock-key".to_string(),
        base_url: Some(mock_server.uri()),
        max_tokens: None,
        temperature: None,
        top_p: None,
        frequency_penalty: None,
        presence_penalty: None,
        response_format: None,
    }).unwrap());

    let db = Arc::new(DbManager::init_in_memory().await.unwrap());
    
    let ctx = Arc::new(WorkflowNodeContext {
        provider,
        model_factory: Arc::new(flock_core::model_factory::DefaultModelFactory::new(
            "openai".to_string(),
            "gpt-4o".to_string(),
            "mock-key".to_string(),
            Some(mock_server.uri()),
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
                    "prompt": "Say hello to: {{input_msg}}",
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

    let run_config = RunnableConfig::default().thread_id("thread-1");
    let final_state = graph.clone().run(initial_state, run_config).await.unwrap();

    let node_outputs = final_state.get("node_outputs").unwrap();
    let llm_output = node_outputs.get("llm_1").unwrap();
    assert_eq!(llm_output.get("greeting").unwrap().as_str().unwrap(), "Workflow processed message successfully!");
}

#[tokio::test]
async fn test_workflow_concurrency_isolation() {
    let mock_server = wiremock::MockServer::start().await;

    struct WorkflowResponder;
    impl wiremock::Respond for WorkflowResponder {
        fn respond(&self, request: &wiremock::Request) -> wiremock::ResponseTemplate {
            let body: serde_json::Value = serde_json::from_slice(&request.body).unwrap();
            let prompt = body["messages"][0]["content"].as_str().unwrap_or("");
            let uuid = prompt.split("hello to:").last().unwrap_or("").trim();
            wiremock::ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": format!("Response for workflow UUID: {}", uuid)
                    }
                }]
            }))
        }
    }

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/v1/chat/completions"))
        .respond_with(WorkflowResponder)
        .mount(&mock_server)
        .await;

    let base_url = mock_server.uri();
    let db = Arc::new(DbManager::init_in_memory().await.unwrap());
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
                base_url: Some(base_url_clone.clone()),
                max_tokens: None,
                temperature: None,
                top_p: None,
                frequency_penalty: None,
                presence_penalty: None,
                response_format: None,
            }).unwrap());

            let ctx = Arc::new(WorkflowNodeContext {
                provider,
                model_factory: Arc::new(flock_core::model_factory::DefaultModelFactory::new(
                    "openai".to_string(),
                    "gpt-4o".to_string(),
                    "mock-key".to_string(),
                    Some(base_url_clone),
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
                            "prompt": "Say hello to: {{input_msg}}",
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

            let run_config = RunnableConfig::default().thread_id(format!("thread-wf-{}", uuid_clone));
            let final_state = graph.run(initial_state, run_config).await.unwrap();
            
            let node_outputs = final_state.get("node_outputs").unwrap();
            let llm_output = node_outputs.get("llm_1").unwrap();
            let greeting = llm_output.get("greeting").unwrap().as_str().unwrap().to_string();
            
            (uuid_clone, greeting)
        });
        tasks.push(handle);
    }

    for task in tasks {
        let (uuid, greeting) = task.await.unwrap();
        assert_eq!(greeting, format!("Response for workflow UUID: {}", uuid));
    }
}
