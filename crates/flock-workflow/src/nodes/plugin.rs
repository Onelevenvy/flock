use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state, interpolate_json_with_context};

pub fn make_plugin_node(
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

            let tool_name = node_data.get("tool").and_then(|v| v.get("name")).and_then(|v| v.as_str()).unwrap_or("");
            let default_val = json!("");
            let args_val = node_data.get("args").unwrap_or(&default_val);
            let interpolated_val = interpolate_json_with_context(args_val, &state, &ctx, &ctx.workflow_id);

            ctx.sink.emit_text_delta(&node_id, &format!("*🔧 正在调用插件 `{}`...*\n", tool_name));

            let tool_args_json: JsonValue = match &interpolated_val {
                JsonValue::String(s) => {
                    serde_json::from_str(s).unwrap_or_else(|_| {
                        json!({ "query": s })
                    })
                }
                other => other.clone(),
            };

            let tool = ctx.tools.get(tool_name).ok_or_else(|| {
                RunnableError::Node(format!("Tool not found: {}", tool_name))
            })?;

            let res = tool.execute(tool_args_json).await;

            ctx.sink.emit_text_delta(&node_id, &format!("\n插件 `{}` 返回结果:\n{}\n", tool_name, res.content));

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "response": res.content
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
