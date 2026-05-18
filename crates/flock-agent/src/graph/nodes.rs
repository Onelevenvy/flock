//! Graph node implementations for the flock agent.
//!
//! Each function here corresponds to one node in the LangGraph graph defined
//! in `builder.rs`.  In Phase 2 these nodes call into the existing
//! `AgentEngine` helpers; eventually they will fully replace the monolithic
//! `AgentEngine::run` loop.
//!
//! Node contract (same as LangGraph examples):
//!   - Input:  `JsonValue` (the current graph state, serialised)
//!   - Output: `Result<JsonValue, RunnableError>` (state patch)
//!
//! A "state patch" is a partial JSON object; LangGraph merges it into the
//! full state via the channel reducers defined on `AgentState`.

use std::sync::Arc;

use langgraph::prelude::RunnableConfig;
use langgraph::runnable::base::RunnableError;
use serde_json::{json, Value as JsonValue};

use flock_core::config::compression::CompressionConfig;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::llm::ThinkingConfig;
use flock_core::types::message::{ContentBlock, Message, Role};
use flock_tools::registry::ToolRegistry;
use langgraph_prebuilt::types::Message as LgMessage;
use langgraph_prebuilt::BaseChatModel;

use crate::approval::ToolApproval;
use crate::context_compression::state::CompactState;
use crate::context_compression::{auto, emergency, estimate, micro};
use crate::sinks::OutputSink;

use super::state::AgentState;

// ---------------------------------------------------------------------------
// Shared context passed into every node via closure capture.
// ---------------------------------------------------------------------------

/// All infrastructure that nodes need but that is NOT part of graph state.
/// Cloned into each node closure via `Arc`.
pub struct NodeContext {
    pub provider: Arc<dyn BaseChatModel>,
    pub tools: Arc<ToolRegistry>,
    pub confirmer: Arc<std::sync::Mutex<ToolApproval>>,
    pub compact_config: CompressionConfig,
    pub plan_config: flock_core::config::plan::PlanConfig,
    pub system_prompt: String,
    pub max_tokens: u32,
    pub thinking: Option<ThinkingConfig>,
    pub compaction_level: flock_core::context_compression::CompressionLevel,
    pub toon_enabled: bool,
    pub max_turns: Option<usize>,
    /// Output sink for streaming events — carries the same sink as the engine.
    pub output: Arc<dyn OutputSink>,
    /// Current message ID — used for output events (same value as engine's current_msg_id).
    pub msg_id: Arc<std::sync::Mutex<String>>,
    /// Current session ID for plan saving.
    pub session_id: Option<String>,
    /// Shared flag for plan mode (synced with tools).
    pub plan_active_flag: Option<Arc<std::sync::atomic::AtomicBool>>,
    pub debug_mode: bool,
    pub provider_label: String,
}

// ---------------------------------------------------------------------------
// Helper: deserialise AgentState from the JsonValue input
// ---------------------------------------------------------------------------

fn parse_state(input: &JsonValue) -> AgentState {
    match serde_json::from_value(input.clone()) {
        Ok(state) => state,
        Err(e) => {
            eprintln!(
                "[WARN][parse_state] failed to deserialize AgentState: {}. \
                 Hint: add #[serde(default)] to all fields in AgentState. \
                 Returning default state (messages will be empty!).",
                e
            );
            AgentState::default()
        }
    }
}

// ---------------------------------------------------------------------------
// Node: compaction_node
// ---------------------------------------------------------------------------

pub fn make_compaction_node(
    ctx: Arc<NodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, _config: RunnableConfig| {
        let ctx = ctx.clone();
        Box::pin(async move {
            ctx.output.emit_info("[node] >>> entering compaction");
            let state = parse_state(&input);
            let mut messages = state.messages.iter()
                .filter_map(|m| serde_json::from_value::<Message>(m.clone()).ok())
                .collect::<Vec<_>>();

            let mut messages_changed = false;
            let mut new_failures = state.compact_consecutive_failures;

            // 1. Microcompact (lightweight, no LLM call, clears old tool results)
            if micro::should_microcompact(&messages, &ctx.compact_config) {
                let result = micro::microcompact(&mut messages, &ctx.compact_config);
                if result.cleared_count > 0 {
                    ctx.output.emit_info(&format!(
                        "Microcompact: cleared {} tool results (~{} tokens freed)",
                        result.cleared_count, result.estimated_tokens_freed
                    ));
                    messages_changed = true;
                }
            }

            // 2. Autocompact (LLM summarization with circuit breaker)
            let mut autocompacted = false;
            let should_compact = auto::should_autocompact(state.last_input_tokens, &ctx.compact_config);
            let circuit_broken = new_failures >= ctx.compact_config.max_failures;

            if should_compact && !circuit_broken {
                match auto::autocompact(
                    ctx.provider.as_ref(),
                    &messages,
                    &state.model,
                    &ctx.compact_config,
                    &mut CompactState {
                        consecutive_failures: new_failures,
                        last_input_tokens: state.last_input_tokens,
                    },
                ).await {
                    Ok(result) => {
                        ctx.output.emit_info(&format!(
                            "Autocompact: summarized {} messages ({} tokens)",
                            result.messages_summarized, result.pre_compact_tokens
                        ));
                        messages = result.messages;
                        messages_changed = true;
                        autocompacted = true;
                        new_failures = 0;
                    }
                    Err(auto::CompactError::CircuitBroken { .. }) => {
                        // Already triggered by new state, skip
                    }
                    Err(e) => {
                        ctx.output.emit_error(&format!("Autocompact failed: {}", e));
                        new_failures = new_failures.saturating_add(1);
                    }
                }
            } else if should_compact && circuit_broken {
                ctx.output.emit_info(&format!(
                    "Autocompact: skipped (circuit breaker tripped after {} consecutive failures, last_input_tokens={})",
                    new_failures, state.last_input_tokens
                ));
            }

            // 3. Emergency check (if autocompact didn't run and still over limit)
            if !autocompacted && emergency::is_at_emergency_limit(state.last_input_tokens, &ctx.compact_config) {
                return Err(RunnableError::Node(format!(
                    "Context window nearly full ({} tokens). Please use /context_compression or start a new conversation.",
                    state.last_input_tokens
                )));
            }

            if messages_changed {
                let new_messages = messages.into_iter()
                    .map(|m| serde_json::to_value(m).unwrap_or(JsonValue::Null))
                    .collect::<Vec<_>>();

                ctx.output.emit_info("[node] <<< exiting compaction (messages changed)");
                Ok(json!({
                    "messages": {
                        "reset": true,
                        "messages": new_messages,
                    },
                    "compact_consecutive_failures": new_failures,
                }))
            } else {
                ctx.output.emit_info("[node] <<< exiting compaction (no changes)");
                Ok(json!({
                    "compact_consecutive_failures": new_failures,
                }))
            }
        })
    }
}

// ---------------------------------------------------------------------------
// Node: llm_node
// ---------------------------------------------------------------------------

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
                    crate::plan::prompt::plan_mode_instructions()
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

// ---------------------------------------------------------------------------
// Routing functions
// ---------------------------------------------------------------------------

/// Route after LLM: if the AI message has tool_calls, go to tools node.
pub fn route_after_llm(input: &JsonValue) -> String {
    let has_tools = input
        .get("messages")
        .and_then(|v| v.as_array())
        .and_then(|msgs| msgs.last())
        .and_then(|msg| {
            // Check tool_calls field (langgraph format)
            if let Some(calls) = msg.get("tool_calls") {
                if let Some(arr) = calls.as_array() {
                    if !arr.is_empty() {
                        return Some(true);
                    }
                }
            }
            // Check content array for ToolUse blocks (flock format)
            if let Some(content) = msg.get("content").and_then(|v| v.as_array()) {
                let has_tool_use = content.iter().any(|block| {
                    block.get("type").and_then(|v| v.as_str()) == Some("tool_use")
                });
                if has_tool_use {
                    return Some(true);
                }
            }
            None
        })
        .unwrap_or(false);

    eprintln!("[route] route_after_llm: has_tools={}", has_tools);

    if has_tools {
        "tools".to_string()
    } else {
        langgraph::constants::END.to_string()
    }
}

/// Route after tools: go to END on quit, otherwise back to compaction.
pub fn route_after_tools(input: &JsonValue) -> String {
    // quit 时 FlockToolNode 设置了 quit_requested=true
    if input.get("quit_requested").and_then(|v| v.as_bool()).unwrap_or(false) {
        eprintln!("[route] route_after_tools: quit_requested=true, routing to END");
        return langgraph::constants::END.to_string();
    }
    "compaction".to_string()
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
