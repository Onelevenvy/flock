use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string};

pub fn make_llm_workflow_node(
    node_id: String,
    node_data: JsonValue,
    ctx: Arc<WorkflowNodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, config: RunnableConfig| {
        let ctx = ctx.clone();
        let node_id = node_id.clone();
        let node_data = node_data.clone();
        Box::pin(async move {
            ctx.sink.emit_node_start(&node_id);
            let state = parse_state(&input);

            let sys_template = node_data.get("systemMessage").and_then(|v| v.as_str()).unwrap_or("");
            let user_template = node_data.get("userMessage").and_then(|v| v.as_str()).unwrap_or("");

            let sys_prompt = interpolate_string(sys_template, &state);
            let user_prompt = interpolate_string(user_template, &state);

            let mut messages = Vec::new();
            if !sys_prompt.is_empty() {
                messages.push(LgMessage::system(sys_prompt));
            }
            for m in &state.messages {
                if let Ok(lg_msg) = serde_json::from_value::<LgMessage>(m.clone()) {
                    messages.push(lg_msg);
                }
            }
            if !user_prompt.is_empty() {
                messages.push(LgMessage::human(user_prompt.clone()));
            }

            let mut rx = ctx.provider.astream(&messages[..], &config);
            let mut assistant_text = String::new();
            let mut thinking_text = String::new();

            while let Some(msg_res) = rx.next().await {
                let msg = msg_res.map_err(|e| RunnableError::Node(e.to_string()))?;
                if let Some(thinking) = msg.thinking() {
                    if !thinking.is_empty() {
                        ctx.sink.emit_thinking(&node_id, thinking);
                        thinking_text.push_str(thinking);
                    }
                }
                if let Some(content) = msg.text() {
                    if !content.is_empty() {
                        ctx.sink.emit_text_delta(&node_id, content);
                        assistant_text.push_str(content);
                    }
                }
            }

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "response": assistant_text
            });
            outputs[&node_id] = node_output.clone();

            ctx.sink.emit_node_done(&node_id, &node_output);

            Ok(json!({
                "node_outputs": outputs,
                "current_node": node_id,
                "messages": [
                    LgMessage::human(user_prompt),
                    LgMessage::ai(assistant_text)
                ],
            }))
        })
    }
}
