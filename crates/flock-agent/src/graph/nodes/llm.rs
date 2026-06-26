use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::base::RunnableError;
use serde_json::{json, Value as JsonValue};

use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::message::{ContentBlock, Message, Role};
use langgraph::prebuilt::types::Message as LgMessage;
use crate::context_compression::estimate;
use super::types::NodeContext;
use super::helpers::parse_state;
use super::message_convert::to_langgraph_message;

pub fn make_llm_node(
    ctx: Arc<NodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, config: RunnableConfig| {
        let ctx = ctx.clone();
        Box::pin(async move {
            let state = parse_state(&input);
            let _msg_id = ctx.msg_id.read().unwrap().clone();

            if let Some(limit) = ctx.max_turns {
                if state.turns as usize >= limit {
                    return Ok(json!({
                        "turns": state.turns + 1,
                    }));
                }
            }

            let messages: Vec<LgMessage> = state.messages.iter()
                .filter_map(|v| {
                    let flock_msg: Message = serde_json::from_value(v.clone()).ok()?;
                    Some(to_langgraph_message(flock_msg))
                })
                .collect();

            let mut final_system_prompt = if state.plan_mode_active {
                format!(
                    "{}\n\n{}",
                    ctx.system_prompt,
                    crate::tools::plan::prompt::plan_mode_instructions()
                )
            } else {
                ctx.system_prompt.clone()
            };

            let mut final_messages = messages;

            for mw in &ctx.middlewares {
                mw.before_llm_call(&ctx, &mut final_system_prompt, &mut final_messages);
            }

            let provider = ctx.provider.bind_tools(
                ctx.tools.to_tool_defs_filtered(|t| {
                    if state.plan_mode_active {
                        t.category() == ToolCategory::Info && t.name() != "EnterPlanMode"
                    } else {
                        t.name() != "ExitPlanMode"
                    }
                }).into_iter().map(|t| {
                    let parameters = if t.deferred && !state.promoted_tools.contains(&t.name) {
                        serde_json::json!({
                            "type": "object",
                            "properties": {},
                            "description": "Schema is hidden. You MUST call the ToolSearch tool with this tool's name as 'query' to load its schema and parameters before you can use it."
                        })
                    } else {
                        t.input_schema.clone()
                    };
                    langgraph::prebuilt::ToolDef {
                        name: t.name,
                        description: t.description,
                        parameters,
                    }
                }).collect()
            );

            let mut lg_messages = vec![LgMessage::system(final_system_prompt.clone())];
            lg_messages.extend(final_messages);

            let mut rx = provider.astream(&lg_messages[..], &config);
            // log::info!("[node:llm] Stream started for provider={}", ctx.provider_label);

            let mut assistant_text = String::new();
            let mut thinking_text = String::new();
            let mut tool_calls: Vec<ContentBlock> = Vec::new();
            let mut turn_input_tokens: u64 = 0;
            let mut turn_output_tokens: u64 = 0;
            let mut turn_cache_creation: u64 = 0;
            let mut turn_cache_read: u64 = 0;

            use tokio_stream::StreamExt;
            while let Some(msg_res) = rx.next().await {
                let msg = match msg_res {
                    Ok(m) => m,
                    Err(e) => {
                        log::error!("[node:llm] Stream error: {}", e);
                        let err_msg = e.to_string();
                        ctx.output.emit_error(&err_msg);
                        if let Ok(mut guard) = ctx.has_error.lock() {
                            *guard = Some(err_msg.clone());
                        }
                        return Err(RunnableError::Node(err_msg));
                    }
                };

                if let Some(thinking) = msg.thinking() {
                    if !thinking.is_empty() {
                         log::debug!("[node:llm] Received thinking chunk: {} chars", thinking.len());
                         if let Some(writer) = langgraph::config::get_stream_writer() {
                             let _ = writer.try_send(json!({
                                 "event": "on_chat_model_stream",
                                 "type": "thinking",
                                 "chunk": thinking,
                             }));
                         }
                         thinking_text.push_str(thinking);
                    }
                }

                if let Some(content) = msg.text() {
                    if !content.is_empty() {
                        log::debug!("[node:llm] Received content chunk: {} chars", content.len());
                        if let Some(writer) = langgraph::config::get_stream_writer() {
                            let _ = writer.try_send(json!({
                                "event": "on_chat_model_stream",
                                "type": "content",
                                "chunk": content,
                            }));
                        }
                        assistant_text.push_str(content);
                    }
                }

                for tc in msg.tool_calls() {
                //    log::info!("[node:llm] Received tool call: {}", tc.name);
                   tool_calls.push(ContentBlock::ToolUse {
                       name: tc.name.clone(),
                       input: tc.args.clone(),
                       id: tc.id.clone().unwrap_or_default(),
                   });
                }

                if let Some(usage) = msg.usage() {
                    // log::info!("[node:llm] Received usage: {:?}", usage);
                    turn_input_tokens = usage.prompt_tokens as u64;
                    turn_output_tokens = usage.completion_tokens as u64;
                    if let Some(creation) = usage.cache_creation_tokens {
                        turn_cache_creation = creation as u64;
                    }
                    if let Some(read) = usage.cache_read_tokens {
                        turn_cache_read = read as u64;
                    }
                }
            }
            // log::info!("[node:llm] Stream completed. Assistant text len: {}, Tool calls: {}", assistant_text.len(), tool_calls.len());

            let msgs_for_estimate: Vec<Message> =
                state.messages.iter().filter_map(|v| serde_json::from_value(v.clone()).ok()).collect();
            let local_estimate = estimate::estimate_tokens_from_messages(&msgs_for_estimate, Some(&final_system_prompt));
            let effective_watermark = if turn_input_tokens > 0 { turn_input_tokens } else { local_estimate };

            let mut assistant_content: Vec<ContentBlock> = Vec::new();
            if !thinking_text.is_empty() {
                assistant_content.push(ContentBlock::Thinking { thinking: thinking_text });
            }
            let _ = assistant_text.chars().count() as u64;

            if !assistant_text.is_empty() {
                assistant_content.push(ContentBlock::Text { text: assistant_text });
            }
            assistant_content.extend(tool_calls.clone());

            let assistant_msg = Message::now(Role::Assistant, assistant_content);
            let assistant_json = serde_json::to_value(&assistant_msg).unwrap_or(json!({}));

            let final_input_tokens = if turn_input_tokens > 0 {
                state.total_input_tokens + turn_input_tokens
            } else {
                state.total_input_tokens.max(effective_watermark)
            };

            let final_output_tokens = if turn_output_tokens > 0 {
                state.total_output_tokens + turn_output_tokens
            } else {
                state.total_output_tokens
            };


            Ok(json!({
                "messages":                     [assistant_json],
                "turns":                        state.turns + 1,
                "total_input_tokens":           final_input_tokens,
                "total_output_tokens":          final_output_tokens,
                "total_cache_creation_tokens":  state.total_cache_creation_tokens + turn_cache_creation,
                "total_cache_read_tokens":      state.total_cache_read_tokens + turn_cache_read,
                "last_input_tokens":            effective_watermark,
            }))
        })
    }
}

