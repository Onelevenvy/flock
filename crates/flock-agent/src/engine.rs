use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use flock_core::config::compression::CompressionConfig;
use flock_core::config::hooks::HookEngine;
use flock_core::config::plan::PlanConfig;
use flock_core::config::settings::Config;
use langgraph::graph::CompiledStateGraph;
use langgraph_checkpoint::checkpoint::base::BaseCheckpointSaver;
use langgraph_checkpoint_sqlite::SqliteSaver;
use langgraph_prebuilt::BaseChatModel;
use langgraph_providers::openai::{OpenAIModel, OpenAIModelConfig};

use flock_core::types::message::{ContentBlock, Message, Role, StopReason, TokenUsage};
use flock_tools::registry::ToolRegistry;

use crate::approval::{ApprovalDecision, ToolApproval};
use crate::context_compression::state::CompactState;
use crate::output::OutputSink;
use crate::plan::state::PlanState;
use crate::session::{Session, SessionManager};
use crate::tool_executor::{execute_tool_calls_with_approval, ExecutionControl};

pub struct AgentEngine {
    provider: Arc<dyn BaseChatModel>,
    tools: Arc<ToolRegistry>,
    /// Local message cache — kept in sync after each graph run.
    /// NOT used as initial input to the graph (checkpointer handles history).
    messages: Vec<Message>,
    system_prompt: String,
    model: String,
    max_tokens: u32,
    max_turns: Option<usize>,
    total_usage: TokenUsage,
    thinking: Option<flock_core::types::llm::ThinkingConfig>,
    /// Resolved provider compat settings (for capability validation)
    compat: flock_core::config::compat::ProviderCompat,
    confirmer: Arc<Mutex<ToolApproval>>,
    hooks: Option<HookEngine>,
    session_manager: Option<SessionManager>,
    current_session: Option<Session>,
    output: Arc<dyn OutputSink>,
    current_msg_id: String,
    approval_manager: Option<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>>,
    protocol_writer: Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>>,
    allow_list: Vec<String>,
    /// Persisted reasoning effort, updated by skill context modifiers.
    current_reasoning_effort: Option<String>,
    /// Compaction configuration (thresholds, enabled flag, etc.)
    compact_config: CompressionConfig,
    /// Plan configuration
    plan_config: PlanConfig,
    /// Runtime compaction state (circuit breaker, last input tokens)
    compact_state: CompactState,
    /// Runtime plan mode state (active flag, pre-plan allow-list, plan file path)
    plan_state: PlanState,
    /// Shared flag read by EnterPlanMode/ExitPlanMode tools to validate transitions.
    plan_active_flag: Option<Arc<AtomicBool>>,
    compaction_level: flock_core::context_compression::CompressionLevel,
    toon_enabled: bool,
    /// Shared msg_id threaded into NodeContext so nodes can emit output events
    /// with the correct message identifier without requiring engine mutability.
    graph_msg_id: Arc<Mutex<String>>,
    turns: usize,
    /// Persistent SQLite checkpointer — shared across all `run()` calls so
    /// LangGraph automatically manages the full conversation history.
    checkpointer: Arc<dyn BaseCheckpointSaver>,
    /// Compiled graph — lazily built on first `run()`, then reused.
    graph: Option<CompiledStateGraph>,
    /// Fixed thread_id for this engine instance.
    /// Corresponds to the session ID when sessions are enabled.
    thread_id: String,
    /// Whether to print verbose [DEBUG] logs to stderr.
    debug_mode: bool,
    provider_label: String,
    db_manager: Option<Arc<flock_core::db::DbManager>>,
    cancel_flag: Arc<AtomicBool>,
}

impl AgentEngine {
    pub async fn new(config: Config, tools: ToolRegistry, output: Arc<dyn OutputSink>) -> Self {
        let provider = Arc::new(OpenAIModel::new(OpenAIModelConfig {
            model: config.model.clone(),
            api_key: config.api_key.clone(),
            api_base: if config.base_url.is_empty() { None } else { Some(config.base_url.clone()) },
            ..Default::default()
        }));
        let provider_label = config.provider_label.clone();
        Self::new_with_provider(provider, config, tools, output).await
    }

    /// Create an engine with an externally-provided provider (for sub-agent sharing)
    pub async fn new_with_provider(
        provider: Arc<dyn BaseChatModel>,
        config: Config,
        tools: ToolRegistry,
        output: Arc<dyn OutputSink>,
    ) -> Self {
        let system_prompt = config.system_prompt.clone().unwrap_or_default();
        let confirmer =
            ToolApproval::new(config.tools.auto_approve, config.tools.allow_list.clone());

        // Use the main flock.db for checkpoints and sessions (single DB file)
        let db_path_str = config.db_path.to_string_lossy().to_string();

        // Initialise the SQLite checkpointer. Fall back to InMemory on error.
        let checkpointer: Arc<dyn BaseCheckpointSaver> =
            Self::init_checkpointer(&output, &db_path_str).await;

        let session_manager = if config.session.enabled {
            match &config.db_manager {
                Some(db) => Some(db.session_manager(config.session.max_sessions)),
                None => {
                    output.emit_error("[session] No DbManager available for SessionManager");
                    None
                }
            }
        } else {
            None
        };

        let allow_list = config.tools.allow_list.clone();
        let compact_config = config.compact.clone();

        Self {
            provider,
            tools: Arc::new(tools),
            messages: Vec::new(),
            system_prompt,
            model: config.model,
            max_tokens: config.max_tokens,
            max_turns: config.max_turns,
            total_usage: TokenUsage::default(),
            thinking: config.thinking,
            compat: config.compat.clone(),
            confirmer: Arc::new(Mutex::new(confirmer)),
            hooks: Some(HookEngine::new(config.hooks.clone())),
            session_manager,
            current_session: None,
            output,
            current_msg_id: String::new(),
            approval_manager: None,
            protocol_writer: None,
            allow_list,
            current_reasoning_effort: None,
            compact_config,
            plan_config: config.plan.clone(),
            compact_state: CompactState::new(),
            plan_state: PlanState::default(),
            plan_active_flag: None,
            compaction_level: config.compact.compaction,
            toon_enabled: config.compact.toon,
            graph_msg_id: Arc::new(Mutex::new(String::new())),
            turns: 0,
            checkpointer,
            graph: None,
            thread_id: uuid::Uuid::new_v4().to_string(),
            debug_mode: false,
            provider_label: config.provider_label.clone(),
            db_manager: config.db_manager.clone(),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Initialise a SQLite-backed checkpointer, emitting a warning and falling
    /// back to in-memory if the database cannot be opened.
    async fn init_checkpointer(
        output: &Arc<dyn OutputSink>,
        db_path: &str,
    ) -> Arc<dyn BaseCheckpointSaver> {
        use langgraph_checkpoint::checkpoint::memory::InMemorySaver;
        let conn_str = format!("sqlite:{}", db_path);
        match SqliteSaver::from_conn_string(&conn_str).await {
            Ok(saver) => {
                match saver.setup().await {
                    Ok(_) => {
                        return Arc::new(saver);
                    }
                    Err(e) => {
                        output.emit_error(&format!(
                            "[checkpointer] SQLite setup failed ({e}), falling back to InMemory"
                        ));
                    }
                }
            }
            Err(e) => {
                output.emit_error(&format!(
                    "[checkpointer] Failed to open SQLite ({e}), falling back to InMemory"
                ));
            }
        }
        Arc::new(InMemorySaver::new())
    }

    /// Create from a resumed session
    pub async fn resume(
        config: Config,
        tools: ToolRegistry,
        output: Arc<dyn OutputSink>,
        session: Session,
    ) -> Self {
        let provider = Arc::new(OpenAIModel::new(OpenAIModelConfig {
            model: config.model.clone(),
            api_key: config.api_key.clone(),
            api_base: if config.base_url.is_empty() { None } else { Some(config.base_url.clone()) },
            ..Default::default()
        }));
        Self::resume_with_provider(provider, config, tools, output, session).await
    }

    /// Create from a resumed session with an externally-provided provider
    pub async fn resume_with_provider(
        provider: Arc<dyn BaseChatModel>,
        config: Config,
        tools: ToolRegistry,
        output: Arc<dyn OutputSink>,
        session: Session,
    ) -> Self {
        let system_prompt = config.system_prompt.clone().unwrap_or_default();
        let confirmer =
            ToolApproval::new(config.tools.auto_approve, config.tools.allow_list.clone());

        // Use the session ID as the thread_id so LangGraph checkpointer
        // correctly links this run to the existing conversation history.
        let thread_id = session.id.clone();

        // Use the main flock.db for checkpoints and sessions (single DB file)
        let db_path_str = config.db_path.to_string_lossy().to_string();

        // Initialise the SQLite checkpointer (same DB as new sessions).
        let checkpointer: Arc<dyn BaseCheckpointSaver> =
            Self::init_checkpointer(&output, &db_path_str).await;

        let session_manager = if config.session.enabled {
            match &config.db_manager {
                Some(db) => Some(db.session_manager(config.session.max_sessions)),
                None => {
                    output.emit_error("[session] No DbManager available for SessionManager");
                    None
                }
            }
        } else {
            None
        };

        let allow_list = config.tools.allow_list.clone();
        let compact_config = config.compact.clone();

        Self {
            provider,
            tools: Arc::new(tools),
            // Keep local message cache for session saving; graph history comes
            // from the checkpointer.
            messages: session.messages.clone(),
            system_prompt,
            model: config.model.clone(),
            max_tokens: config.max_tokens,
            max_turns: config.max_turns,
            total_usage: session.total_usage.clone(),
            thinking: config.thinking,
            compat: config.compat.clone(),
            confirmer: Arc::new(Mutex::new(confirmer)),
            hooks: Some(HookEngine::new(config.hooks.clone())),
            session_manager,
            current_session: Some(session),
            output,
            current_msg_id: String::new(),
            approval_manager: None,
            protocol_writer: None,
            allow_list,
            current_reasoning_effort: None,
            compact_config,
            plan_config: config.plan.clone(),
            compact_state: CompactState::new(),
            plan_state: PlanState::default(),
            plan_active_flag: None,
            compaction_level: config.compact.compaction,
            toon_enabled: config.compact.toon,
            graph_msg_id: Arc::new(Mutex::new(String::new())),
            turns: 0,
            checkpointer,
            graph: None,
            thread_id,
            debug_mode: false,
            provider_label: config.provider_label.clone(),
            db_manager: config.db_manager.clone(),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }

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

    /// Initialize a new session for this engine run
    pub async fn init_session(
        &mut self,
        provider_name: &str,
        cwd: &str,
        session_id: Option<&str>,
    ) -> anyhow::Result<()> {
        if let Some(mgr) = &self.session_manager {
            let sid = session_id
                .map(|s| s.to_string())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            let session = mgr.create(provider_name, &self.model, cwd, &sid).await?;
            self.current_session = Some(session);
        }
        Ok(())
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

    /// Run the agent loop with user input (always using LangGraph-based execution)
    pub async fn run(&mut self, user_input: &str, msg_id: &str) -> Result<AgentResult, AgentError> {
        self.cancel_flag.store(false, Ordering::SeqCst);
        self.current_msg_id = msg_id.to_string();
        self.output.emit_stream_start(msg_id);

        log::info!("[engine] Starting run for msg_id={}, input_len={}", msg_id, user_input.len());

        use crate::graph::{build_agent_graph, AgentState, NodeContext};
        use langgraph::prelude::RunnableConfig;

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


        use langgraph::types::Command;
        use langgraph::types::StreamMode;
        use tokio_stream::StreamExt;

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
                                                    self.output.emit_thinking(chunk, &msg_id);
                                                } else {
                                                    self.output.emit_text_delta(chunk, &msg_id);
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
                                    &msg_id,
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
                                    match self.confirmer.lock().unwrap().check(&name, &truncated) {
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

    async fn save_session(&mut self) {
        if let (Some(mgr), Some(session)) = (&self.session_manager, &mut self.current_session) {
            session.messages = self.messages.clone();
            session.total_usage = self.total_usage.clone();
            session.updated_at = chrono::Utc::now();
            match mgr.save_metadata(session).await {
                Ok(Some(new_title)) => {
                    log::info!("[summary] Session title updated in database to fallback: {}", new_title);
                    if let Some(ref writer) = self.protocol_writer {
                        log::info!("[summary] Emitting instant fallback TitleUpdated event for thread {}", session.id);
                        let _ = writer.emit(&flock_core::ipc_interface::events::ProtocolEvent::TitleUpdated {
                            thread_id: session.id.clone(),
                            title: new_title,
                        });
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    self.output
                        .emit_error(&format!("Failed to save session metadata: {}", e));
                }
            }

            // Trigger AI topic summary asynchronously on first user-assistant turn (exactly 1 user message in history)
            let user_msg_count = session.messages.iter()
                .filter(|m| m.role == flock_core::types::message::Role::User)
                .count();
            if user_msg_count == 1 {
                if let Some(db) = &self.db_manager {
                    let db = db.clone();
                    let thread_id = session.id.clone();
                    let messages = session.messages.clone();
                    let default_provider = self.provider.clone();
                    let protocol_writer = self.protocol_writer.clone();

                    tokio::spawn(async move {
                        if let Err(e) = run_background_summary(db, thread_id, messages, default_provider, protocol_writer).await {
                            eprintln!("[summary] Background auto summary failed: {}", e);
                        }
                    });
                }
            }
        }
    }

    async fn sync_and_save_session(
        &mut self,
        config: &langgraph::prelude::RunnableConfig,
    ) {
        use crate::graph::AgentState;
        use flock_core::types::message::ContentBlock;
        use flock_core::types::message::Message;

        // Emit text delta to frontend to visually notify user
        self.output.emit_text_delta("\n\n*🚫 对话已被用户中止*", &self.current_msg_id);

        let snapshot_res = {
            let app = self.graph.as_ref().unwrap();
            app.get_state(config)
        };

        if let Ok(snapshot) = snapshot_res {
            let mut msgs: Vec<Message> = Vec::new();
            if let Some(msgs_array) = snapshot.values.get("messages").and_then(|v| v.as_array()) {
                msgs = msgs_array
                    .iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect();
            }

            let mut found_assistant = false;
            if let Some(last_msg) = msgs.last_mut() {
                if last_msg.role == flock_core::types::message::Role::Assistant {
                    last_msg.content.push(ContentBlock::Text {
                        text: "\n\n*🚫 对话已被用户中止*".to_string(),
                    });
                    found_assistant = true;
                }
            }

            if !found_assistant {
                msgs.push(Message::now(
                    flock_core::types::message::Role::Assistant,
                    vec![ContentBlock::Text {
                        text: "*🚫 对话已被用户中止*".to_string(),
                    }],
                ));
            }

            self.messages = msgs;

            let graph_state: AgentState =
                serde_json::from_value(snapshot.values.clone()).unwrap_or_default();
            self.total_usage = graph_state.to_token_usage();
            self.compact_state.last_input_tokens = graph_state.last_input_tokens;
            
            self.save_session().await;
        }
    }

    /// Run stop hooks when the agent session ends
    pub async fn run_stop_hooks(&self) {
        if let Some(hook_engine) = &self.hooks {
            let messages = hook_engine.run_stop().await;
            for msg in messages {
                eprintln!("{}", msg);
            }
        }
    }
}

// (Tests removed — logic migrated to graph nodes. See graph/nodes.rs)

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

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct DbModelConfig {
    provider: String,
    model: Option<String>,
}

async fn run_background_summary(
    db: std::sync::Arc<flock_core::db::DbManager>,
    thread_id: String,
    messages: Vec<Message>,
    default_provider: std::sync::Arc<dyn BaseChatModel>,
    protocol_writer: Option<std::sync::Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>>,
) -> anyhow::Result<()> {
    log::info!("[summary] Starting background auto-summary task for thread: {}", thread_id);

    // 1. Fetch existing summary to check if it's already customized
    let existing_sum: Option<String> = sqlx::query_scalar(
        "SELECT summary FROM session_metadata WHERE thread_id = ?1"
    )
    .bind(&thread_id)
    .fetch_optional(db.pool())
    .await
    .unwrap_or(None);

    let existing_sum = existing_sum.unwrap_or_default();
    log::info!("[summary] Current thread summary in DB: {:?}", existing_sum);

    // Generate a default summary (first user message truncated)
    let default_sum = messages
        .iter()
        .find(|m| m.role == Role::User)
        .and_then(|m| {
            m.content.iter().find_map(|c| {
                if let ContentBlock::Text { text } = c {
                    let mut s = text.clone();
                    if s.chars().count() > 80 {
                        let truncated: String = s.chars().take(77).collect();
                        s = format!("{}...", truncated);
                    }
                    Some(s)
                } else {
                    None
                }
            })
        })
        .unwrap_or_default();

    // If it's already customized (not empty, not a placeholder, and not equal to the default
    // message-based fallback), do nothing. Placeholder titles like "对话 1779024059" or
    // "Session conv_..." are created by create_conversation() and should still be overwritten
    // by the AI-generated summary.
    if !existing_sum.is_empty() && existing_sum != default_sum && !is_placeholder_title(&existing_sum) {
        log::info!("[summary] Thread summary has already been customized. Skipping auto-summary.");
        return Ok(());
    }

    // 2. Fetch the summary model configuration from app_config
    let summary_cfg_val: Option<serde_json::Value> = db.get_config("summary_model").await;
    log::info!("[summary] Loaded summary_model config: {:?}", summary_cfg_val);
    
    let mut use_custom_provider = false;
    let mut summary_provider: Option<Box<dyn BaseChatModel>> = None;

    if let Some(val) = summary_cfg_val {
        if let (Some(provider_id), Some(model_name)) = (
            val.get("provider").and_then(|v| v.as_str()),
            val.get("model").and_then(|v| v.as_str()),
        ) {
            if provider_id != "follow" {
                log::info!("[summary] Initializing custom summary model: provider={}, model={}", provider_id, model_name);
                // Load provider credentials
                if let Some(p) = db.get_provider(provider_id).await.unwrap_or(None) {
                    let params = flock_core::model_factory::ModelProviderParams {
                        provider_type: p.provider_type,
                        model: model_name.to_string(),
                        api_key: p.api_key.unwrap_or_default(),
                        base_url: p.base_url,
                        max_tokens: None,
                    };
                    if let Ok(m) = flock_core::model_factory::create_model(params) {
                        summary_provider = Some(m);
                        use_custom_provider = true;
                        log::info!("[summary] Custom summary model initialized successfully");
                    } else {
                        log::warn!("[summary] Failed to create custom model; falling back to default provider");
                    }
                } else {
                    log::warn!("[summary] Custom provider credentials not found; falling back to default provider");
                }
            }
        }
    }

    // 3. Construct user prompt for summary
    let first_user_query = messages
        .iter()
        .find(|m| m.role == Role::User)
        .and_then(|m| {
            m.content.iter().find_map(|c| {
                if let ContentBlock::Text { text } = c {
                    Some(text.as_str())
                } else {
                    None
                }
            })
        })
        .unwrap_or("");

    if first_user_query.is_empty() {
        log::info!("[summary] First user query is empty. Skipping auto-summary.");
        return Ok(());
    }

    let summary_prompt = format!(
        "请为以下用户的对话首条提问总结一个非常简短的主题（原则上不超过10个字，用中文，不要包含任何标点符号、引号、括号或多余修饰）：\n\n\"{}\"",
        first_user_query
    );

    // Construct standard flock Message list first (existing unified pattern)
    let messages_for_llm = vec![
        Message::new(
            Role::System,
            vec![ContentBlock::Text {
                text: "你是一个对话主题总结助手。请直接输出这笔对话的最简短主题，不要有任何多余的标点符号或前缀解释。".to_string(),
            }],
        ),
        Message::new(
            Role::User,
            vec![ContentBlock::Text {
                text: summary_prompt,
            }],
        ),
    ];

    // Convert via existing to_langgraph_message helper to ensure decoupling from concrete model types
    let conv_messages: Vec<langgraph_prebuilt::types::Message> = messages_for_llm
        .into_iter()
        .map(crate::graph::to_langgraph_message)
        .collect();

    let runnable_config = langgraph_checkpoint::config::RunnableConfig::new();

    // 4. Run LLM call using streaming (astream) to robustly collect content and bypass non-streaming gateway bugs
    let response_text = if use_custom_provider {
        if let Some(provider) = summary_provider {
            use tokio_stream::StreamExt;
            let mut rx = provider.astream(&conv_messages[..], &runnable_config);
            let mut text = String::new();
            let mut thinking = String::new();
            while let Some(msg_res) = rx.next().await {
                match msg_res {
                    Ok(msg) => {
                        if let Some(chunk) = msg.text() {
                            text.push_str(chunk);
                        }
                        if let Some(think) = msg.thinking() {
                            thinking.push_str(think);
                        }
                    }
                    Err(e) => {
                        log::warn!("[summary] Custom summary model stream chunk error: {}", e);
                    }
                }
            }
            log::info!("[summary] Custom model stream finished. Text: {:?}, Thinking: {:?}", text, thinking);

            if text.trim().is_empty() && !thinking.trim().is_empty() {
                log::info!("[summary] Custom model text was empty but thinking was not. Falling back to thinking content!");
                text = thinking;
            }

            if !text.trim().is_empty() {
                text
            } else {
                log::warn!("[summary] Custom summary model call yielded empty response. Falling back to default provider.");
                log::info!("[summary] Invoking default provider as fallback using astream...");
                let mut rx = default_provider.astream(&conv_messages[..], &runnable_config);
                let mut text = String::new();
                while let Some(msg_res) = rx.next().await {
                    if let Ok(msg) = msg_res {
                        if let Some(chunk) = msg.text() {
                            text.push_str(chunk);
                        }
                    }
                }
                text
            }
        } else {
            return Err(anyhow::anyhow!("Custom provider was flagged but could not be initialized"));
        }
    } else {
        // Follow default provider
        log::info!("[summary] Invoking default provider using astream...");
        use tokio_stream::StreamExt;
        let mut rx = default_provider.astream(&conv_messages[..], &runnable_config);
        let mut text = String::new();
        while let Some(msg_res) = rx.next().await {
            if let Ok(msg) = msg_res {
                if let Some(chunk) = msg.text() {
                    text.push_str(chunk);
                }
            }
        }
        text
    };

    // 5. Clean up response text
    let mut clean_title = response_text
        .trim()
        .replace(['\"', '“', '”', '`', '\'', '「', '」', '《', '》', '【', '】', '：', ':', '。', '.', '！', '!', '？', '?'], "");
        
    if clean_title.chars().count() > 10 {
        clean_title = clean_title.chars().take(8).collect::<String>() + "...";
    }

    log::info!("[summary] Cleaned title result: {:?}", clean_title);

    if !clean_title.is_empty() {
        // Update database
        log::info!("[summary] Writing summary title to database for thread {}", thread_id);
        db.update_conversation_title(&thread_id, &clean_title).await?;
        
        // Emit TitleUpdated event through protocol writer
        if let Some(writer) = protocol_writer {
            log::info!("[summary] Emitting TitleUpdated event for thread {}", thread_id);
            let _ = writer.emit(&flock_core::ipc_interface::events::ProtocolEvent::TitleUpdated {
                thread_id: thread_id.clone(),
                title: clean_title.clone(),
            });
        }
    }

    log::info!("[summary] Background auto-summary completed successfully for thread: {}", thread_id);
    Ok(())
}

/// Determine whether a summary string is an auto-generated placeholder title
/// (as opposed to a user-edited or AI-generated title that should be preserved).
///
/// Placeholder patterns come from `create_conversation()` in conversations.rs:
///   - "对话 <digits>"    e.g. "对话 1779024059"
///   - "Session <id>"    e.g. "Session conv_1779024059"  (list_workspace_sessions fallback)
fn is_placeholder_title(s: &str) -> bool {
    // "对话 " followed by digits (numeric timestamp suffix)
    if let Some(rest) = s.strip_prefix("对话 ") {
        if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
            return true;
        }
    }
    // "Session " followed by any non-empty suffix
    if s.starts_with("Session ") && s.len() > "Session ".len() {
        return true;
    }
    false
}
