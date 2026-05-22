use std::sync::atomic::Ordering;
use langgraph::types::{Command, Interrupt};
use serde_json::Value as JsonValue;
use flock_core::types::message::ContentBlock;
use crate::approval::ApprovalDecision;
use crate::tool_executor::{execute_tool_calls_with_approval, ExecutionControl};
use crate::engine::{AgentEngine, AgentError};

pub async fn handle_interrupt(
    engine: &mut AgentEngine,
    interrupts: Vec<Interrupt>,
    msg_id: &str,
) -> Result<JsonValue, AgentError> {
    // FlockToolNode called interrupt() — read tool_calls from interrupt value.
    let interrupt_event = interrupts.into_iter().next();

    if let Some(event) = interrupt_event {
        engine.output.emit_info("[engine] interrupt received, reading tool_calls from interrupt value");

        let pending_json = event.value.get("pending_tool_calls")
            .and_then(|v| v.as_array());

        if let Some(calls_json) = pending_json {
            let tool_calls: Vec<ContentBlock> = calls_json
                .iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect();

            engine.output.emit_info(&format!(
                "[engine] found {} tool_calls, processing approval",
                tool_calls.len()
            ));

            let resume_val = if let Some(ref approval_mgr) = engine.approval_manager {
                // ── json_stream mode: protocol approval flow ──
                let writer = engine.protocol_writer.as_ref()
                    .expect("protocol_writer must be set when approval_manager is set");
                let auto_approve = engine.confirmer.lock().unwrap().is_auto_approve();

                tokio::select! {
                    _ = async {
                        loop {
                            if engine.cancel_flag.load(Ordering::Relaxed) {
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
                        &engine.tools,
                        &tool_calls,
                        approval_mgr,
                        writer,
                        msg_id,
                        auto_approve,
                        &engine.allow_list,
                        engine.hooks.as_mut(),
                        engine.compaction_level,
                        engine.toon_enabled,
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
                engine.output.emit_info("[engine] terminal mode: asking user for approval");
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
                        match engine.confirmer.lock().unwrap().check(name, &truncated) {
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

            engine.output.emit_info(&format!("[engine] decision resume_val = {:?}, resuming graph", resume_val));
            let cmd = Command::resume(resume_val);
            serde_json::to_value(cmd).map_err(|e| AgentError::ApiError(e.to_string()))
        } else {
            // No pending_tool_calls in interrupt value — auto-approve
            engine.output.emit_info("[engine] no pending_tool_calls in interrupt, auto-approving");
            let cmd = Command::resume(serde_json::json!({ "decision": "approved" }));
            serde_json::to_value(cmd).map_err(|e| AgentError::ApiError(e.to_string()))
        }
    } else {
        // No interrupt event — auto-approve
        engine.output.emit_info("[engine] no interrupt event, auto-approving");
        let cmd = Command::resume(serde_json::json!({ "decision": "approved" }));
        serde_json::to_value(cmd).map_err(|e| AgentError::ApiError(e.to_string()))
    }
}
