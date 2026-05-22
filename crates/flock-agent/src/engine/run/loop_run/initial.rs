use std::sync::atomic::Ordering;
use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use serde_json::Value as JsonValue;
use flock_core::types::message::{ContentBlock, Message, Role};
use crate::engine::{AgentEngine, AgentError};

pub async fn prepare_run(
    engine: &mut AgentEngine,
    user_input: &str,
    msg_id: &str,
) -> Result<(JsonValue, RunnableConfig), AgentError> {
    engine.cancel_flag.store(false, Ordering::SeqCst);
    engine.current_msg_id = msg_id.to_string();
    engine.output.emit_stream_start(msg_id);

    log::info!("[engine] Starting run for msg_id={}, input_len={}", msg_id, user_input.len());

    use crate::graph::{build_agent_graph, AgentState, NodeContext};

    // ── Update shared msg_id so nodes emit events with the right ID ──
    *engine.graph_msg_id.lock().unwrap() = msg_id.to_string();

    // ── Lazily build the graph once and reuse across turns ────────────
    if engine.graph.is_none() {
        let ctx = Arc::new(NodeContext {
            provider: Arc::clone(&engine.provider),
            tools: Arc::clone(&engine.tools),
            confirmer: Arc::clone(&engine.confirmer),
            compact_config: engine.compact_config.clone(),
            plan_config: engine.plan_config.clone(),
            system_prompt: engine.system_prompt.clone(),
            max_tokens: engine.max_tokens,
            thinking: engine.thinking.clone(),
            compaction_level: engine.compaction_level,
            toon_enabled: engine.toon_enabled,
            max_turns: engine.max_turns,
            output: Arc::clone(&engine.output),
            msg_id: Arc::clone(&engine.graph_msg_id),
            session_id: engine.current_session.as_ref().map(|s| s.id.clone()),
            plan_active_flag: engine.plan_active_flag.clone(),
            debug_mode: engine.debug_mode,
            provider_label: engine.provider_label.clone(),
        });
        let app = build_agent_graph(ctx, Arc::clone(&engine.checkpointer))
            .map_err(|e| AgentError::ApiError(format!("Graph build error: {e}")))?;
        engine.graph = Some(app);
    }

    // ── Build user message early to trigger instant auto-summary ──
    let new_user_msg_struct = Message::now(
        Role::User,
        vec![ContentBlock::Text { text: user_input.to_string() }],
    );

    let is_first_turn = engine.messages.iter()
        .filter(|m| m.role == Role::User)
        .count() == 0;

    if is_first_turn {
        log::info!("[summary] First turn detected. Saving user message and triggering immediate auto-summary.");
        engine.messages.push(new_user_msg_struct.clone());
        engine.save_session().await;
    }

    let new_user_msg = serde_json::to_value(&new_user_msg_struct)
        .map_err(|e| AgentError::ApiError(format!("Serialise user msg: {e}")))?;
    log::debug!("[engine] Created new user message for graph");
    let initial_state = AgentState::from_engine_snapshot(
        engine.model.clone(),
        engine.current_reasoning_effort.clone(),
        &engine.total_usage,
        engine.compact_state.last_input_tokens.max(engine.total_usage.input_tokens),
        engine.turns,
        engine.allow_list.clone(),
        engine.plan_state.is_active,
        engine.plan_state.pre_plan_allow_list.clone(),
        // Only the current user message — history comes from checkpointer
        vec![new_user_msg],
    );

    let initial_json = serde_json::to_value(&initial_state)
        .map_err(|e| AgentError::ApiError(format!("State serialisation error: {e}")))?;

    // ── Config: use fixed thread_id for this engine instance ──────────
    let mut config = RunnableConfig::new();
    config.insert(
        "configurable".to_string(),
        serde_json::json!({ "thread_id": &engine.thread_id }),
    );

    Ok((initial_json, config))
}
