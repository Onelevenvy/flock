use std::sync::atomic::Ordering;
use crate::engine::{AgentEngine, AgentResult, AgentError};

pub mod initial;
pub mod stream;
pub mod approval;
pub mod finalize;

impl AgentEngine {
    /// Run the agent loop with user input (always using LangGraph-based execution)
    pub async fn run(&mut self, user_input: &str, msg_id: &str) -> Result<AgentResult, AgentError> {
        let (mut current_input, config) = initial::prepare_run(self, user_input, msg_id).await?;

        let result = loop {
            if self.cancel_flag.load(Ordering::Relaxed) {
                self.output.emit_info("[engine] cancel_flag is set at loop start, aborting run");
                self.sync_and_save_session(&config).await;
                return Err(AgentError::UserAborted);
            }

            // Stream and handle inner-stream cancel check
            stream::run_stream(self, &current_input, &config, msg_id).await?;

            let snapshot = self.graph.as_ref().unwrap()
                .get_state(&config)
                .map_err(|e| AgentError::ApiError(e.to_string()))?;

            // ── DEBUG: Print messages count in snapshot to diagnose memory confusion ──
            if self.debug_mode {
                let msg_count = snapshot.values.get("messages")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0);
                let interrupt_count = snapshot.interrupts.len();
                eprintln!("[DEBUG][engine] after astream: snapshot.messages={} interrupts={}", msg_count, interrupt_count);
            }

            if !snapshot.interrupts.is_empty() {
                let next_input = approval::handle_interrupt(self, snapshot.interrupts, msg_id).await?;
                current_input = next_input;
            } else {
                // No interrupt — graph execution complete, break out of loop
                self.output.emit_info("[engine] no interrupt, graph execution complete");
                // Check if execution ended due to quit request
                if snapshot.values.get("quit_requested").and_then(|v| v.as_bool()).unwrap_or(false) {
                    self.output.emit_info("[engine] quit_requested=true, returning UserAborted");
                    self.sync_and_save_session(&config).await;
                    return Err(AgentError::UserAborted);
                }
                break snapshot.values;
            }
        };

        finalize::finalize_run(self, &result, msg_id).await
    }
}
