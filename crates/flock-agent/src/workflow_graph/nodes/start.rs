use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state};

pub fn make_start_node(
    node_id: String,
    ctx: Arc<WorkflowNodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, _config: RunnableConfig| {
        let ctx = ctx.clone();
        let node_id = node_id.clone();
        Box::pin(async move {
            ctx.sink.emit_node_start(&node_id);
            let state = parse_state(&input);
            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            if !outputs.get(&node_id).is_some() {
                outputs[&node_id] = json!({
                    "query": state.input_msg
                });
            } else if !outputs[&node_id].get("query").is_some() {
                outputs[&node_id]["query"] = json!(state.input_msg);
            }

            if node_id != "start" {
                outputs["start"] = outputs[&node_id].clone();
            }
            ctx.sink.emit_node_done(&node_id, &outputs[&node_id]);
            Ok(json!({
                "node_outputs": outputs,
                "current_node": node_id,
            }))
        })
    }
}
