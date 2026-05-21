use std::sync::atomic::Ordering;
use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use langgraph::types::{Command, StreamMode};
use tokio_stream::StreamExt;

use flock_core::types::message::{ContentBlock, Message, Role};
use crate::approval::ApprovalDecision;
use crate::tool_executor::{execute_tool_calls_with_approval, ExecutionControl};
use crate::engine::{AgentEngine, AgentResult, AgentError};

impl AgentEngine {
    /// Run the agent loop with user input (always using LangGraph-based execution)
    pub async fn run(&mut self, user_input: &str, msg_id: &str) -> Result<AgentResult, AgentError> {
        self.cancel_flag.store(false, Ordering::SeqCst);
        self.current_msg_id = msg_id.to_string();
        self.output.emit_stream_start(msg_id);

        log::info!("[engine] Starting run for msg_id={}, input_len={}", msg_id, user_input.len());

        use crate::graph::{build_agent_graph, AgentState, NodeContext};

        // ── Update shared msg_id so nodes emit events with the right ID ──
        *self.graph_msg_id.lock().unwrap() = msg_id.to_string();

        // ── Lazily build the graph once and reuse across turns ────────────
        if self.graph.is_none() {
            let ctx = Arc::new(NodeContext {
                provider: Arc::clone(&self.provider),
                tools: Arc::clone(&self.tools),
                confirmer: Arc::clone(&self.confirmer),
                compact_config: self.compact_config.clone(),
                plan_config: self.plan_config.clone(),
                system_prompt: self.system_prompt.clone(),
                max_tokens: self.max_tokens,
                thinking: self.thinking.clone(),
                compaction_level: self.compaction_level,
                toon_enabled: self.toon_enabled,
                max_turns: self.max_turns,
                output: Arc::clone(&self.output),
                msg_id: Arc::clone(&self.graph_msg_id),
                session_id: self.current_session.as_ref().map(|s| s.id.clone()),
                plan_active_flag: self.plan_active_flag.clone(),
                debug_mode: self.debug_mode,
                provider_label: self.provider_label.clone(),
            });
            let app = build_agent_graph(ctx, Arc::clone(&self.checkpointer))
                .map_err(|e| AgentError::ApiError(format!("Graph build error: {e}")))?;
            self.graph = Some(app);
        }

        // ── Build user message early to trigger instant auto-summary ──
        let new_user_msg_struct = Message::now(
            Role::User,
            vec![ContentBlock::Text { text: user_input.to_string() }],
        );

        let is_first_turn = self.messages.iter()
            .filter(|m| m.role == Role::User)
            .count() == 0;

        if is_first_turn {
            log::info!("[summary] First turn detected. Saving user message and triggering immediate auto-summary.");
            self.messages.push(new_user_msg_struct.clone());
            self.save_session().await;
        }

        let new_user_msg = serde_json::to_value(&new_user_msg_struct)
            .map_err(|e| AgentError::ApiError(format!("Serialise user msg: {e}")))?;
        log::debug!("[engine] Created new user message for graph");
        let initial_state = AgentState::from_engine_snapshot(
            self.model.clone(),
            self.current_reasoning_effort.clone(),
            &self.total_usage,
            self.compact_state.last_input_tokens.max(self.total_usage.input_tokens),
            self.turns,
            self.allow_list.clone(),
            self.plan_state.is_active,
            self.plan_state.pre_plan_allow_list.clone(),
            // Only the current user message — history comes from checkpointer
            vec![new_user_msg],
        );

        let initial_json = serde_json::to_value(&initial_state)
            .map_err(|e| AgentError::ApiError(format!("State serialisation error: {e}")))?;

        // ── Config: use fixed thread_id for this engine instance ──────────
        let mut config = RunnableConfig::new();
        config.insert(
            "configurable".to_string(),
            serde_json::json!({ "thread_id": &self.thread_id }),
        );

        let mut current_input = initial_json;
        let result = loop {
            if self.cancel_flag.load(Ordering::Relaxed) {
                self.output.emit_info("[engine] cancel_flag is set at loop start, aborting run");
                self.sync_and_save_session(&config).await;
                return Err(AgentError::UserAborted);
            }

            let mut stream = self.graph.as_ref().unwrap().astream(
                &current_input,
                &config,
                vec![StreamMode::Updates, StreamMode::Custom]
            );

            let mut cancelled = false;
            loop {
                tokio::select! {
                    _ = async {
                        loop {
                            if self.cancel_flag.load(Ordering::Relaxed) {
                                break;
                            }
                            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                        }
                    } => {
                        cancelled = true;
                        break;
                    }
                    part_opt = stream.next() => {
                        if let Some(part) = part_opt {
                            match part.mode {
                                StreamMode::Custom => {
                                    if let Some(event) = part.data.get("event").and_then(|v| v.as_str()) {
                                        if event == "on_chat_model_stream" {
                                            let type_str = part.data.get("type").and_then(|v| v.as_str()).unwrap_or("content");
                                            if let Some(chunk) = part.data.get("chunk").and_then(|v| v.as_str()) {
                                                if type_str == "thinking" {
                                                    self.output.emit_thinking(chunk, msg_id);
                                                } else {
                                                    self.output.emit_text_delta(chunk, msg_id);
                                                }
                                            }
                                        }
                                    }
                                }
                                _ => {}
                            }
                        } else {
                            break;
                        }
                    }
                }
            }

            if cancelled {
                self.output.emit_info("[engine] cancel_flag is set during stream, aborting run");
                self.sync_and_save_session(&config).await;
                return Err(AgentError::UserAborted);
            }

            let snapshot = self.graph.as_ref().unwrap().get_state(&config).map_err(|e| AgentError::ApiError(e.to_string()))?;

            // ── DEBUG: 打印 snapshot 里 messages 条数，诊断记忆混乱 ──
            if self.debug_mode {
                let msg_count = snapshot.values.get("messages")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0);
                let interrupt_count = snapshot.interrupts.len();
                eprintln!("[DEBUG][engine] after astream: snapshot.messages={} interrupts={}", msg_count, interrupt_count);
            }

            if !snapshot.interrupts.is_empty() {
                // FlockToolNode called interrupt() — read tool_calls from interrupt value.
                let interrupt_event = snapshot.interrupts.into_iter().next();

                if let Some(event) = interrupt_event {
                    self.output.emit_info("[engine] interrupt received, reading tool_calls from interrupt value");

                    let pending_json = event.value.get("pending_tool_calls")
                        .and_then(|v| v.as_array());

                    if let Some(calls_json) = pending_json {
                        let tool_calls: Vec<ContentBlock> = calls_json
                            .iter()
                            .filter_map(|v| serde_json::from_value(v.clone()).ok())
                            .collect();

                        self.output.emit_info(&format!(
                            "[engine] found {} tool_calls, processing approval",
                            tool_calls.len()
                        ));

                        let resume_val = if let Some(ref approval_mgr) = self.approval_manager {
                            // ── json_stream mode: protocol approval flow ──
                            let writer = self.protocol_writer.as_ref()
                                .expect("protocol_writer must be set when approval_manager is set");
                            let auto_approve = self.confirmer.lock().unwrap().is_auto_approve();

                            tokio::select! {
                                _ = async {
                                    loop {
                                        if self.cancel_flag.load(Ordering::Relaxed) {
                                            break;
                                        }
                                        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                                    }
                                } => {
                                    // ── Emit ToolCancelled events for all pending tool calls so the frontend closes the approval components ──
                                    use flock_core::ipc_interface::events::ProtocolEvent;
                                    for call in &tool_calls {
                                        if let ContentBlock::ToolUse { id, .. } = call {
                                            let _ = writer.emit(&ProtocolEvent::ToolCancelled {
                                                msg_id: msg_id.to_string(),
                                                call_id: id.clone(),
                                                reason: "Session aborted by user".to_string(),
                                            });
                                        }
                                    }
                                    serde_json::json!({
                                        "decision": "quit",
                                    })
                                }
                                res = execute_tool_calls_with_approval(
                                    &self.tools,
                                    &tool_calls,
                                    approval_mgr,
                                    writer,
                                    msg_id,
                                    auto_approve,
                                    &self.allow_list,
                                    self.hooks.as_mut(),
                                    self.compaction_level,
                                    self.toon_enabled,
                                ) => {
                                    match res {
                                        Ok(outcome) => {
                                            let has_denied = outcome.results.iter().any(|r| {
                                                if let ContentBlock::ToolResult { content, .. } = r {
                                                    content.starts_with("Tool denied: ")
                                                } else {
                                                    false
                                                }
                                            });
                                            let decision = if has_denied { "denied" } else { "approved" };
                                            serde_json::json!({
                                                "decision": decision,
                                                "results": outcome.results,
                                            })
                                        }
                                        Err(ExecutionControl::Quit) => {
                                            serde_json::json!({
                                                "decision": "quit",
                                            })
                                        }
                                    }
                                }
                            }
                        } else {
                            // ── Terminal mode: ask user via confirmer.check() ──
                            self.output.emit_info("[engine] terminal mode: asking user for approval");
                            let mut decision = "approved".to_string();
                            for call in &tool_calls {
                                if let ContentBlock::ToolUse { name, input, .. } = call {
                                    let input_str = serde_json::to_string(&input).unwrap_or_default();
                                    let truncated = if input_str.len() > 200 {
                                        let end = input_str.char_indices().nth(200)
                                            .map(|(i, _)| i).unwrap_or(input_str.len());
                                        format!("{}...", &input_str[..end])
                                    } else {
                                        input_str
                                    };
                                    match self.confirmer.lock().unwrap().check(name, &truncated) {
                                        ApprovalDecision::Quit => { decision = "quit".to_string(); break; }
                                        ApprovalDecision::Denied => { decision = "denied".to_string(); }
                                        ApprovalDecision::Approved => {}
                                    }
                                }
                            }
                            serde_json::json!({
                                "decision": decision,
                            })
                        };

                        self.output.emit_info(&format!("[engine] decision resume_val = {:?}, resuming graph", resume_val));
                        let cmd = Command::resume(resume_val);
                        current_input = serde_json::to_value(cmd)
                            .map_err(|e| AgentError::ApiError(e.to_string()))?;
                    } else {
                        // No pending_tool_calls in interrupt value — auto-approve
                        self.output.emit_info("[engine] no pending_tool_calls in interrupt, auto-approving");
                        let cmd = Command::resume(serde_json::json!({ "decision": "approved" }));
                        current_input = serde_json::to_value(cmd)
                            .map_err(|e| AgentError::ApiError(e.to_string()))?;
                    }
                } else {
                    // No interrupt event — auto-approve
                    self.output.emit_info("[engine] no interrupt event, auto-approving");
                    let cmd = Command::resume(serde_json::json!({ "decision": "approved" }));
                    current_input = serde_json::to_value(cmd)
                        .map_err(|e| AgentError::ApiError(e.to_string()))?;
                }
            } else {
                // No interrupt — graph execution complete, break out of loop
                self.output.emit_info("[engine] no interrupt, graph execution complete");
                // 检查是否因为 quit 导致的结束
                if snapshot.values.get("quit_requested").and_then(|v| v.as_bool()).unwrap_or(false) {
                    self.output.emit_info("[engine] quit_requested=true, returning UserAborted");
                    self.sync_and_save_session(&config).await;
                    return Err(AgentError::UserAborted);
                }
                break snapshot.values;
            }
        }; // end loop

        // ── Sync graph output back into engine state ──────────────────────

        // messages: parse back to Vec<Message>
        if let Some(msgs) = result.get("messages").and_then(|v| v.as_array()) {
            self.messages = msgs
                .iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect();
        }

        // token usage
        let graph_state: AgentState =
            serde_json::from_value(result.clone()).unwrap_or_default();
        let new_usage = graph_state.to_token_usage();
        self.total_usage = new_usage.clone();
        self.compact_state.last_input_tokens = graph_state.last_input_tokens;
        self.compact_state.consecutive_failures = graph_state.compact_consecutive_failures;
        self.turns = graph_state.turns as usize;

        // model / effort / allow_list / plan_state
        if !graph_state.model.is_empty() {
            self.model = graph_state.model.clone();
        }
        self.current_reasoning_effort = graph_state.reasoning_effort.clone();
        self.allow_list = graph_state.allow_list.clone();
        self.plan_state.is_active = graph_state.plan_mode_active;
        self.plan_state.pre_plan_allow_list = graph_state.pre_plan_allow_list.clone();

        // Update plan_active_flag if set
        if let Some(ref flag) = self.plan_active_flag {
            flag.store(
                graph_state.plan_mode_active,
                std::sync::atomic::Ordering::Release,
            );
        }

        // ── Extract final assistant text ──────────────────────────────────
        let final_text = self
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

        self.save_session().await;

        // Emit stream end stats
        self.output.emit_stream_end(
            msg_id,
            graph_state.turns as usize,
            new_usage.input_tokens,
            new_usage.output_tokens,
            new_usage.cache_creation_tokens,
            new_usage.cache_read_tokens,
        );

        Ok(AgentResult {
            text: final_text,
            stop_reason: flock_core::types::message::StopReason::EndTurn,
            usage: new_usage,
            turns: graph_state.turns as usize,
        })
    }
}
