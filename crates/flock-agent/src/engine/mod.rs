use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use flock_core::config::compression::CompressionConfig;
use flock_core::config::hooks::HookEngine;
use flock_core::config::plan::PlanConfig;
use langgraph::graph::CompiledStateGraph;
use langgraph::checkpoint::BaseCheckpointSaver;
use langgraph::prebuilt::BaseChatModel;

use flock_core::types::message::{Message, StopReason, TokenUsage};
use flock_tools::registry::ToolRegistry;

use crate::context_compression::state::CompactState;
use crate::session::{Session, SessionManager};
use crate::sinks::OutputSink;
use crate::tools::plan::state::PlanState;

pub mod init;
pub mod run;
pub mod summary;

pub struct AgentEngine {
    pub(crate) provider: Arc<dyn BaseChatModel>,
    pub(crate) tools: Arc<ToolRegistry>,
    /// Local message cache — kept in sync after each graph run.
    /// NOT used as initial input to the graph (checkpointer handles history).
    pub(crate) messages: Vec<Message>,
    pub(crate) system_prompt: String,
    pub(crate) model: String,
    pub(crate) max_tokens: u32,
    pub(crate) max_turns: Option<usize>,
    pub(crate) total_usage: TokenUsage,
    pub(crate) thinking: Option<flock_core::types::llm::ThinkingConfig>,
    /// Resolved provider compat settings (for capability validation)
    pub(crate) compat: flock_core::config::compat::ProviderCompat,
    pub(crate) auto_approve: bool,
    pub(crate) hooks: Option<HookEngine>,
    pub(crate) session_manager: Option<SessionManager>,
    pub(crate) current_session: Option<Session>,
    pub(crate) output: Arc<dyn OutputSink>,
    pub(crate) current_msg_id: String,
    pub(crate) approval_manager: Option<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>>,
    pub(crate) protocol_writer: Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>>,
    pub(crate) allow_list: Vec<String>,
    /// Persisted reasoning effort, updated by skill context modifiers.
    pub(crate) current_reasoning_effort: Option<String>,
    /// Compaction configuration (thresholds, enabled flag, etc.)
    pub(crate) compact_config: CompressionConfig,
    /// Plan configuration
    pub(crate) plan_config: PlanConfig,
    /// Runtime compaction state (circuit breaker, last input tokens)
    pub(crate) compact_state: CompactState,
    /// Runtime plan mode state (active flag, pre-plan allow-list, plan file path)
    pub(crate) plan_state: PlanState,
    /// Shared flag read by EnterPlanMode/ExitPlanMode tools to validate transitions.
    pub(crate) plan_active_flag: Option<Arc<AtomicBool>>,
    pub(crate) compaction_level: flock_core::context_compression::CompressionLevel,
    pub(crate) toon_enabled: bool,
    /// Shared msg_id threaded into NodeContext so nodes can emit output events
    /// with the correct message identifier without requiring engine mutability.
    pub(crate) graph_msg_id: Arc<std::sync::RwLock<String>>,
    pub(crate) turns: usize,
    /// Persistent SQLite checkpointer — shared across all `run()` calls so
    /// LangGraph automatically manages the full conversation history.
    pub(crate) checkpointer: Arc<dyn BaseCheckpointSaver>,
    /// Compiled graph — lazily built on first `run()`, then reused.
    pub(crate) graph: Option<CompiledStateGraph>,
    /// Fixed thread_id for this engine instance.
    /// Corresponds to the session ID when sessions are enabled.
    pub(crate) thread_id: String,
    /// Whether to print verbose [DEBUG] logs to stderr.
    pub(crate) debug_mode: bool,
    pub provider_label: String,
    pub(crate) db_manager: Option<Arc<flock_core::db::DbManager>>,
    pub(crate) cancel_flag: Arc<AtomicBool>,
    pub(crate) has_error: Arc<Mutex<Option<String>>>,
    pub(crate) promoted_tools: Vec<String>,
    pub(crate) dynamic_context_reminder: Option<String>,
    pub(crate) graph_dynamic_context_reminder: Arc<std::sync::RwLock<Option<String>>>,
}

#[derive(Debug)]
pub struct AgentResult {
    pub text: String,
    pub stop_reason: StopReason,
    pub usage: TokenUsage,
    pub turns: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("User aborted the session")]
    UserAborted,
    #[error("Context window nearly full ({input_tokens} tokens used, limit {limit})")]
    ContextTooLong { input_tokens: u64, limit: usize },
}

impl AgentEngine {
    pub fn set_cancel_flag(&mut self, flag: Arc<AtomicBool>) {
        self.cancel_flag = flag;
    }

    pub fn compaction_level(&self) -> flock_core::context_compression::CompressionLevel {
        self.compaction_level
    }

    /// Get a reference to the shared provider
    pub fn provider(&self) -> &Arc<dyn BaseChatModel> {
        &self.provider
    }

    /// Get a reference to the resolved compat settings
    pub fn compat(&self) -> &flock_core::config::compat::ProviderCompat {
        &self.compat
    }

    pub fn tool_names(&self) -> Vec<String> {
        self.tools.tool_names()
    }

    pub fn registry_mut(&mut self) -> &mut ToolRegistry {
        Arc::get_mut(&mut self.tools)
            .expect("registry_mut called while tools Arc has multiple owners")
    }

    /// Get the current session ID (if sessions are enabled and initialized)
    pub fn current_session_id(&self) -> Option<String> {
        self.current_session.as_ref().map(|s| s.id.clone())
    }

    /// Get a reference to the output sink
    pub fn output(&self) -> &dyn OutputSink {
        self.output.as_ref()
    }

    pub fn set_approval_manager(&mut self, mgr: Arc<flock_core::ipc_interface::approval::ToolApprovalManager>) {
        self.approval_manager = Some(mgr);
    }

    pub fn set_protocol_writer(&mut self, writer: Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>) {
        self.protocol_writer = Some(writer);
    }

    /// Set the initial reasoning effort override (used by sub-agents spawned with an effort override).
    pub fn set_initial_reasoning_effort(&mut self, effort: Option<String>) {
        self.current_reasoning_effort = effort;
    }

    /// Set the shared plan-mode active flag.
    ///
    /// This flag is shared with EnterPlanMode/ExitPlanMode tools so they can
    /// validate transitions (e.g. reject double-entry).  The engine updates
    /// the flag when processing `PlanModeTransition` context modifiers.
    pub fn set_plan_active_flag(&mut self, flag: Arc<AtomicBool>) {
        self.plan_active_flag = Some(flag);
    }

    /// Default thinking budget when "enabled" is requested without a specific budget.
    const DEFAULT_THINKING_BUDGET: u32 = 10_000;

    /// Apply a runtime config update received from the ipc_interface layer.
    ///
    /// Returns a list of human-readable change descriptions for the Info event.
    /// Empty list means no fields were changed.
    pub fn apply_config_update(
        &mut self,
        model: Option<String>,
        thinking: Option<String>,
        thinking_budget: Option<u32>,
        effort: Option<String>,
        compaction: Option<String>,
    ) -> Vec<String> {
        let mut changes = Vec::new();

        if let Some(new_model) = model {
            let old = std::mem::replace(&mut self.model, new_model.clone());
            changes.push(format!("model: {old} → {new_model}"));
        }

        if let Some(thinking_str) = thinking {
            if !self.compat.supports_thinking() {
                changes.push("thinking: not supported by current provider".to_string());
            } else {
                match thinking_str.as_str() {
                    "enabled" => {
                        let budget = thinking_budget.unwrap_or(Self::DEFAULT_THINKING_BUDGET);
                        self.thinking = Some(flock_core::types::llm::ThinkingConfig::Enabled {
                            budget_tokens: budget,
                        });
                        changes.push(format!("thinking: enabled (budget: {budget})"));
                    }
                    "disabled" => {
                        self.thinking = Some(flock_core::types::llm::ThinkingConfig::Disabled);
                        changes.push("thinking: disabled".to_string());
                    }
                    other => {
                        changes.push(format!("thinking: ignored invalid value \"{other}\""));
                    }
                }
            }
        } else if let Some(new_budget) = thinking_budget
            && let Some(flock_core::types::llm::ThinkingConfig::Enabled { budget_tokens }) =
            &mut self.thinking
        {
            *budget_tokens = new_budget;
            changes.push(format!("thinking budget: {new_budget}"));
        }

        if let Some(new_effort) = effort {
            if new_effort.is_empty() {
                self.current_reasoning_effort = None;
                changes.push("effort: cleared".to_string());
            } else if !self.compat.supports_effort() {
                changes.push("effort: not supported by current provider".to_string());
            } else {
                let levels = self.compat.effort_levels();
                if !levels.is_empty() && !levels.iter().any(|l| l == &new_effort) {
                    changes.push(format!(
                        "effort: invalid level \"{}\" (valid: {})",
                        new_effort,
                        levels.join(", ")
                    ));
                } else {
                    let old = self
                        .current_reasoning_effort
                        .replace(new_effort.clone())
                        .unwrap_or_else(|| "none".to_string());
                    changes.push(format!("effort: {old} → {new_effort}"));
                }
            }
        }

        if let Some(ref level_str) = compaction {
            match level_str.parse::<flock_core::context_compression::CompressionLevel>() {
                Ok(new_level) => {
                    let old = self.compaction_level.to_string();
                    self.compaction_level = new_level;
                    changes.push(format!("compaction: {old} → {new_level}"));
                }
                Err(e) => {
                    changes.push(format!("compaction: invalid ({e})"));
                }
            }
        }

        changes
    }
}
