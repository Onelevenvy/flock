use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string};

pub fn make_agent_workflow_node(
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

            let tool_names: Vec<String> = node_data.get("tools")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            // Bind tools
            let tool_defs = ctx.tools.to_tool_defs_filtered(|t| tool_names.contains(&t.name().to_string()));
            let bound_tools: Vec<_> = tool_defs.into_iter().map(|t| langgraph_prebuilt::ToolDef {
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
            }).collect();

            let provider = ctx.provider.bind_tools(bound_tools);

            let mut local_messages = vec![
                LgMessage::system(sys_prompt),
                LgMessage::human(user_prompt),
            ];

            let mut loop_count = 0;
            let max_loops = 10;
            let mut final_response = String::new();

            loop {
                loop_count += 1;
                if loop_count > max_loops {
                    return Err(RunnableError::Node("Max tool loop count exceeded".to_string()));
                }

                let mut rx = provider.astream(&local_messages[..], &config);
                let mut assistant_text = String::new();
                let mut tool_calls = Vec::new();

                while let Some(msg_res) = rx.next().await {
                    let msg = msg_res.map_err(|e| RunnableError::Node(e.to_string()))?;
                    if let Some(content) = msg.text() {
                        if !content.is_empty() {
                            ctx.sink.emit_text_delta(&node_id, content);
                            assistant_text.push_str(content);
                        }
                    }
                    for tc in msg.tool_calls() {
                        tool_calls.push(tc.clone());
                    }
                }
                drop(rx);

                final_response = assistant_text.clone();

                let ai_msg = LgMessage::ai_with_tool_calls(assistant_text.clone(), tool_calls.clone());
                local_messages.push(ai_msg);

                if tool_calls.is_empty() {
                    break;
                }

                // Execute tool calls
                for tc in tool_calls {
                    ctx.sink.emit_text_delta(&node_id, &format!("\n\n*🔧 调用工具 `{}`...*\n", tc.name));
                    let tool = ctx.tools.get(&tc.name).ok_or_else(|| {
                        RunnableError::Node(format!("Tool not found: {}", tc.name))
                    })?;

                    let tool_res = tool.execute(tc.args.clone()).await;
                    ctx.sink.emit_text_delta(&node_id, &format!("*工具 `{}` 返回结果: {}*\n\n", tc.name, tool_res.content));

                    let tool_msg = LgMessage::Tool {
                        tool_call_id: tc.id.clone().unwrap_or_default(),
                        content: langgraph_prebuilt::types::MessageContent::Text(tool_res.content.clone()),
                        name: None,
                        id: None,
                        status: "success".to_string(),
                    };
                    local_messages.push(tool_msg);
                }
            }

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "response": final_response
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
