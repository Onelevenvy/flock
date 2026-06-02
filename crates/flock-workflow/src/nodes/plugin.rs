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

            // 智能降级适配：如果工具需要的参数没有被填入，但 state 中有 input_msg 且不为空
            if let Some(tool_obj) = tool_args_json.as_object_mut() {
                if let Ok(schema) = serde_json::to_value(tool.input_schema()) {
                    if let Some(properties) = schema.get("properties").and_then(|v| v.as_object()) {
                        let required_list = schema.get("required").and_then(|v| v.as_array());
                        let debug_input = &state.input_msg;
                        if !debug_input.is_empty() {
                            if let Some(req_arr) = required_list {
                                for req_val in req_arr {
                                    if let Some(req_name) = req_val.as_str() {
                                        let is_empty_or_missing = match tool_obj.get(req_name) {
                                            None => true,
                                            Some(v) => {
                                                if let Some(s) = v.as_str() {
                                                    s.trim().is_empty()
                                                } else {
                                                    v.is_null()
                                                }
                                            }
                                        };
                                        if is_empty_or_missing {
                                            tool_obj.insert(req_name.to_string(), json!(debug_input));
                                        }
                                    }
                                }
                            } else if properties.len() == 1 {
                                if let Some(sole_key) = properties.keys().next() {
                                    let is_empty_or_missing = match tool_obj.get(sole_key) {
                                        None => true,
                                        Some(v) => {
                                            if let Some(s) = v.as_str() {
                                                s.trim().is_empty()
                                            } else {
                                                v.is_null()
                                            }
                                        }
                                    };
                                    if is_empty_or_missing {
                                        tool_obj.insert(sole_key.to_string(), json!(debug_input));
                                    }
                                }
                            }
                        }
                    }
                }
            }

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
