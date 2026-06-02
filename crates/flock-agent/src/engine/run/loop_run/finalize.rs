use serde_json::Value as JsonValue;
use flock_core::types::message::{ContentBlock, Role, StopReason, Message};
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
        let mut final_msgs: Vec<Message> = msgs
            .iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();

        // 终极安全对齐：以内存中拥有打断警告的最精确 messages 历史为唯一绝对权威基准！
        // 我们不进行整条消息链的覆盖（防止任何底层 checkpointer 导致的倒退覆写和消息蒸发），
        // 而是将 Graph 最终生成的最新的那个 Assistant 消息平滑追加或更新在内存消息的尾部！
        if let Some(graph_last) = final_msgs.last() {
            if graph_last.role == Role::Assistant {
                let already_has = engine.messages.last().map(|m| m.role == Role::Assistant).unwrap_or(false);
                if !already_has {
                    log::info!("[finalize] Smoothly appending new AI assistant reply to memory messages");
                    engine.messages.push(graph_last.clone());
                } else if let Some(last_msg) = engine.messages.last_mut() {
                    // 如果最后一句话已经是 Assistant，但是它的内容在生成完毕后更新了，我们在此同步更新它
                    last_msg.content = graph_last.content.clone();
                }
            }
        }
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
