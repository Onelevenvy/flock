use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context};

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
            let args_template = node_data.get("args").and_then(|v| v.as_str()).unwrap_or("");
            let interpolated_args = interpolate_string_with_context(args_template, &state, &ctx, &ctx.workflow_id);

            ctx.sink.emit_text_delta(&node_id, &format!("*🔧 正在调用插件 `{}`...*\n", tool_name));

            let mut tool_args_json: JsonValue = serde_json::from_str(&interpolated_args).unwrap_or_else(|_| {
                // If not valid JSON, wrap it as a string
                json!({ "query": interpolated_args })
            });

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
