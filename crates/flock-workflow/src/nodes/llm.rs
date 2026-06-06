use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context, resolve_model, parse_retry_config, parse_timeout_config, execute_with_retry, extract_images_from_outputs, check_model_vision_capability};

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
            let retry_cfg = parse_retry_config(&node_data);
            let timeout_cfg = parse_timeout_config(&node_data);

            let result = execute_with_retry(&retry_cfg, &timeout_cfg, || {
                let ctx = ctx.clone();
                let node_id = node_id.clone();
                let node_data = node_data.clone();
                let input = input.clone();
                let config = config.clone();
                async move {
                    let state = parse_state(&input);

                    let sys_template = node_data.get("systemMessage").and_then(|v| v.as_str()).unwrap_or("");
                    let user_template = node_data.get("userMessage").and_then(|v| v.as_str()).unwrap_or("");

                    let sys_prompt = interpolate_string_with_context(sys_template, &state, &ctx, &ctx.workflow_id);
                    let user_prompt = interpolate_string_with_context(user_template, &state, &ctx, &ctx.workflow_id);

                    let mut messages = Vec::new();
                    if !sys_prompt.is_empty() {
                        messages.push(LgMessage::system(sys_prompt));
                    }
                    for m in &state.messages {
                        if let Ok(lg_msg) = serde_json::from_value::<LgMessage>(m.clone()) {
                            messages.push(lg_msg);
                        }
                    }
                    let extracted_images = extract_images_from_outputs(&state.node_outputs);
                    let human_msg = if !extracted_images.is_empty() {
                        let configured_model = node_data.get("model")
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.is_empty());
                        let model_name = if let Some(m) = configured_model {
                            m.to_string()
                        } else {
                            let default_model: Option<String> = sqlx::query_scalar(
                                "SELECT value FROM config WHERE key = 'model'"
                            )
                            .fetch_optional(ctx.db.pool())
                            .await
                            .unwrap_or(None);
                            default_model.unwrap_or_else(|| "gpt-4o".to_string())
                        };
                        if !check_model_vision_capability(&ctx.db, &model_name).await {
                            return Err(format!("The resolved model '{}' does not support vision capability, but image inputs were provided. Please switch to a vision-capable model or remove the images.", model_name));
                        }

                        let mut blocks = vec![
                            langgraph_prebuilt::types::ContentBlock::Text {
                                text: user_prompt.clone(),
                            }
                        ];
                        for (mime, data) in &extracted_images {
                            blocks.push(langgraph_prebuilt::types::ContentBlock::ImageUrl {
                                image_url: langgraph_prebuilt::types::ImageUrl {
                                    url: format!("data:{};base64,{}", mime, data),
                                    detail: None,
                                },
                            });
                        }
                        LgMessage::Human {
                            content: langgraph_prebuilt::types::MessageContent::Blocks(blocks),
                            id: None,
                        }
                    } else {
                        LgMessage::human(user_prompt.clone())
                    };

                    if !user_prompt.is_empty() || !extracted_images.is_empty() {
                        messages.push(human_msg.clone());
                    }

                    ctx.sink.emit_text_delta(&node_id, "\u{200b}");

                    let model = resolve_model(&node_data, &ctx);
                    let mut rx = model.astream(&messages[..], &config);
                    let mut assistant_text = String::new();
                    let mut thinking_text = String::new();

                    while let Some(msg_res) = rx.next().await {
                        if ctx.cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                            return Err("Workflow execution cancelled by user".to_string());
                        }
                        let msg = msg_res.map_err(|e| format!("{}", e))?;
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

                    Ok::<JsonValue, String>(json!({
                        "node_outputs": outputs,
                        "current_node": node_id,
                        "messages": [
                            human_msg,
                            LgMessage::ai(assistant_text)
                        ],
                    }))
                }
            }).await;

            if let Err(ref e) = result {
                ctx.sink.emit_error(e);
                if let Ok(mut guard) = ctx.has_error.lock() {
                    *guard = Some(e.clone());
                }
            }

            result.map_err(|e| RunnableError::Node(e))
        })
    }
}
