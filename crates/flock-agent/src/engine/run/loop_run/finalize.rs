use serde_json::Value as JsonValue;
use flock_core::types::message::{ContentBlock, Role, StopReason};
use crate::graph::AgentState;
use crate::engine::{AgentEngine, AgentResult, AgentError};

pub async fn finalize_run(
    engine: &mut AgentEngine,
    result: &JsonValue,
    msg_id: &str,
) -> Result<AgentResult, AgentError> {
    // ── Sync graph output back into engine state ──────────────────────

    // messages: parse back to Vec<Message>
    if let Some(msgs) = result.get("messages").and_then(|v| v.as_array()) {
        engine.messages = msgs
            .iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();
    }

    // token usage
    let graph_state: AgentState =
        serde_json::from_value(result.clone()).unwrap_or_default();
    let new_usage = graph_state.to_token_usage();
    engine.total_usage = new_usage.clone();
    engine.compact_state.last_input_tokens = graph_state.last_input_tokens;
    engine.compact_state.consecutive_failures = graph_state.compact_consecutive_failures;
    engine.turns = graph_state.turns as usize;

    // model / effort / allow_list / plan_state
    if !graph_state.model.is_empty() {
        engine.model = graph_state.model.clone();
    }
    engine.current_reasoning_effort = graph_state.reasoning_effort.clone();
    engine.allow_list = graph_state.allow_list.clone();
    engine.plan_state.is_active = graph_state.plan_mode_active;
    engine.plan_state.pre_plan_allow_list = graph_state.pre_plan_allow_list.clone();

    // Update plan_active_flag if set
    if let Some(ref flag) = engine.plan_active_flag {
        flag.store(
            graph_state.plan_mode_active,
            std::sync::atomic::Ordering::Release,
        );
    }

    // ── Extract final assistant text ──────────────────────────────────
    let final_text = engine
        .messages
        .iter()
        .rev()
        .find_map(|m| {
            if m.role == Role::Assistant {
                m.content.iter().find_map(|c| {
                    if let ContentBlock::Text { text } = c {
                        Some(text.clone())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        })
        .unwrap_or_default();

    engine.save_session().await;

    // Emit stream end stats
    engine.output.emit_stream_end(
        msg_id,
        graph_state.turns as usize,
        new_usage.input_tokens,
        new_usage.output_tokens,
        new_usage.cache_creation_tokens,
        new_usage.cache_read_tokens,
    );

    Ok(AgentResult {
        text: final_text,
        stop_reason: StopReason::EndTurn,
        usage: new_usage,
        turns: graph_state.turns as usize,
    })
}
