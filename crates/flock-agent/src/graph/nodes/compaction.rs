use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::base::RunnableError;
use serde_json::{json, Value as JsonValue};

use flock_core::types::message::Message;
use crate::context_compression::state::CompactState;
use crate::context_compression::{auto, emergency, micro};
use super::types::NodeContext;
use super::helpers::parse_state;

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
                    "Context window nearly full ({} tokens). Please use /mod or start a new conversation.",
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
