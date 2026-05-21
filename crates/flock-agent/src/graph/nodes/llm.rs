use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::base::RunnableError;
use serde_json::{json, Value as JsonValue};

use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::message::{ContentBlock, Message, Role};
use langgraph_prebuilt::types::Message as LgMessage;
use crate::context_compression::estimate;
use super::types::NodeContext;
use super::helpers::parse_state;

pub fn make_llm_node(
    ctx: Arc<NodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, config: RunnableConfig| {
        let ctx = ctx.clone();
        Box::pin(async move {
            ctx.output.emit_info("[node] >>> entering llm");
            // ── DEBUG STEP 1: 打印 raw input ──
            if ctx.debug_mode {
                let msgs_raw = input.get("messages");
                let msgs_len = msgs_raw.and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
                let msgs_type = match msgs_raw {
                    None => "MISSING",
                    Some(v) if v.is_array() => "Array",
                    Some(v) if v.is_null() => "Null",
                    _ => "Other",
                };
                eprintln!("[DEBUG][llm] raw input.messages type={} len={}", msgs_type, msgs_len);
                // 也打印 input 里所有 key
                if let Some(obj) = input.as_object() {
                    let keys: Vec<&str> = obj.keys().map(|s| s.as_str()).collect();
                    eprintln!("[DEBUG][llm] raw input keys={:?}", keys);
                }
            }
            let state = parse_state(&input);
            let _msg_id = ctx.msg_id.lock().unwrap().clone();

            if let Some(limit) = ctx.max_turns {
                if state.turns as usize >= limit {
                    return Ok(json!({
                        "turns": state.turns + 1,
                    }));
                }
            }

            // ── DEBUG: 打印 state.messages 信息帮助诊断记忆混乱 ──────────────
            if ctx.debug_mode {
                eprintln!("[DEBUG][llm] state.messages count = {}", state.messages.len());
                for (i, raw_msg) in state.messages.iter().enumerate() {
                    let role = raw_msg.get("role").and_then(|v| v.as_str()).unwrap_or(
                        raw_msg.get("type").and_then(|v| v.as_str()).unwrap_or("?")
                    );
                    // 内容摘要：char-safe，取前60字
                    let content_summary = {
                        let content_str = raw_msg.get("content")
                            .map(|c| c.to_string())
                            .unwrap_or_default();
                        let truncated: String = content_str.chars().take(60).collect();
                        if content_str.chars().count() > 60 {
                            format!("{}...", truncated)
                        } else {
                            truncated
                        }
                    };
                    let has_tc = raw_msg.get("tool_calls")
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(0);
                    eprintln!("[DEBUG][llm]   msg[{}] role={} tool_calls={} content={}", i, role, has_tc, content_summary);
                }
            }

            let messages: Vec<LgMessage> = state.messages.iter()
                .filter_map(|v| {
                    let flock_msg: Message = serde_json::from_value(v.clone()).ok()?;
                    Some(to_langgraph_message(flock_msg))
                })
                .collect();

            if ctx.debug_mode {
                eprintln!("[DEBUG][llm] converted LgMessages count = {}", messages.len());
                for (i, lm) in messages.iter().enumerate() {
                    let type_str = match lm {
                        LgMessage::Human { .. } => "Human",
                        LgMessage::Ai { tool_calls, .. } => if tool_calls.is_empty() { "Ai" } else { "Ai+ToolCalls" },
                        LgMessage::Tool { tool_call_id: _tool_call_id, .. } => "Tool",
                        LgMessage::System { .. } => "System",
                        _ => "Other",
                    };
                    eprintln!("[DEBUG][llm]   lmsg[{}] type={}", i, type_str);
                }
            }

            let system = if state.plan_mode_active {
                format!(
                    "{}\n\n{}",
                    ctx.system_prompt,
                    crate::tools::plan::prompt::plan_mode_instructions()
                )
            } else {
                ctx.system_prompt.clone()
            };

            let provider = ctx.provider.bind_tools(
                ctx.tools.to_tool_defs_filtered(|t| {
                    if state.plan_mode_active {
                        t.category() == ToolCategory::Info && t.name() != "EnterPlanMode"
                    } else {
                        t.name() != "ExitPlanMode"
                    }
                }).into_iter().map(|t| langgraph_prebuilt::ToolDef {
                    name: t.name,
                    description: t.description,
                    parameters: t.input_schema,
                }).collect()
            );

            let mut final_messages = vec![LgMessage::system(system.clone())];
            final_messages.extend(messages);

            let mut rx = provider.astream(&final_messages[..], &config);
            log::info!("[node:llm] Stream started for provider={}", ctx.provider_label);

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
                        return Err(RunnableError::Node(e.to_string()));
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
                   log::info!("[node:llm] Received tool call: {}", tc.name);
                   tool_calls.push(ContentBlock::ToolUse {
                       name: tc.name.clone(),
                       input: tc.args.clone(),
                       id: tc.id.clone().unwrap_or_default(),
                   });
                }

                if let Some(usage) = msg.usage() {
                    log::info!("[node:llm] Received usage: {:?}", usage);
                    turn_input_tokens = usage.prompt_tokens as u64;
                    turn_output_tokens = usage.completion_tokens as u64;
                }
            }
            log::info!("[node:llm] Stream completed. Assistant text len: {}, Tool calls: {}", assistant_text.len(), tool_calls.len());

            let msgs_for_estimate: Vec<Message> =
                state.messages.iter().filter_map(|v| serde_json::from_value(v.clone()).ok()).collect();
            let local_estimate = estimate::estimate_tokens_from_messages(&msgs_for_estimate, Some(&system));
            let effective_watermark = if turn_input_tokens > 0 { turn_input_tokens } else { local_estimate };

            if local_estimate > turn_input_tokens && turn_input_tokens > 0
                && local_estimate.saturating_sub(turn_input_tokens) > 10_000
            {
                ctx.output.emit_info(&format!(
                    "Token watermark override: provider={}, local_estimate={}, using={}",
                    turn_input_tokens, local_estimate, effective_watermark
                ));
            }

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

            ctx.output.emit_info(&format!(
                "[node] <<< exiting llm (tool_calls={})",
                tool_calls.len()
            ));

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

pub fn to_langgraph_message(flock_msg: Message) -> LgMessage {
    let mut text = String::new();
    let mut thinking = None;
    let mut tool_calls = Vec::new();

    for block in flock_msg.content {
        match block {
            ContentBlock::Text { text: t } => text.push_str(&t),
            ContentBlock::Thinking { thinking: t } => thinking = Some(t),
            ContentBlock::ToolUse { id, name, input } => {
                tool_calls.push(langgraph_prebuilt::ToolCall {
                    id: Some(id),
                    name,
                    args: input,
                });
            }
            ContentBlock::ToolResult { tool_use_id, content, is_error } => {
                return LgMessage::Tool {
                    tool_call_id: tool_use_id,
                    content: langgraph_prebuilt::types::MessageContent::Text(content),
                    name: None,
                    id: None,
                    status: if is_error { "error".to_string() } else { "success".to_string() },
                };
            }
        }
    }

    match flock_msg.role {
        Role::System => LgMessage::system(text),
        Role::User => LgMessage::human(text),
        Role::Assistant => {
            if tool_calls.is_empty() {
                let mut msg = LgMessage::ai(text);
                if let LgMessage::Ai { thinking: ref mut th, .. } = msg {
                    *th = thinking;
                }
                msg
            } else {
                let mut msg = LgMessage::ai_with_tool_calls(text, tool_calls);
                if let LgMessage::Ai { thinking: ref mut th, .. } = msg {
                    *th = thinking;
                }
                msg
            }
        }
        Role::Tool => {
            LgMessage::System {
                content: langgraph_prebuilt::types::MessageContent::Text("unknown tool result".to_string()),
                id: None,
            }
        }
    }
}
