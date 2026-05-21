use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string};

pub fn make_human_node(
    node_id: String,
    node_data: JsonValue,
    ctx: Arc<WorkflowNodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, _config: RunnableConfig| {
        let ctx = ctx.clone();
        let node_id = node_id.clone();
        let node_data = node_data.clone();
        Box::pin(async move {
            ctx.sink.emit_node_start(&node_id);
            let state = parse_state(&input);

            let title_template = node_data.get("title").and_then(|v| v.as_str()).unwrap_or("Waiting for review");
            let title = interpolate_string(title_template, &state);

            ctx.sink.emit_text_delta(&node_id, &format!("\n\n*⏳ 正在等待人工确认: `{}`...*\n", title));

            // Call langgraph interrupt
            let resume_val = match langgraph::types::interrupt(
                json!({
                    "node_id": node_id,
                    "title": title,
                    "interaction_type": "review"
                })
            ) {
                Ok(val) => val,
                Err(e) => return Err(RunnableError::Interrupt(e.into())),
            };

            let choice = resume_val.get("choice").and_then(|v| v.as_str()).unwrap_or("approved").to_string();
            ctx.sink.emit_text_delta(&node_id, &format!("人工确认结果: `{}`", choice));

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "choice": choice
            });
            outputs[&node_id] = node_output.clone();

            ctx.sink.emit_node_done(&node_id, &node_output);

            Ok(json!({
                "node_outputs": outputs,
                "current_node": node_id,
            }))
        })
    }
}
