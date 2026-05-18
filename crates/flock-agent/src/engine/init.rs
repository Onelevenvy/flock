use std::sync::{Arc, Mutex};
use langgraph_checkpoint::checkpoint::base::BaseCheckpointSaver;
use langgraph_checkpoint_sqlite::SqliteSaver;
use langgraph_prebuilt::BaseChatModel;
use langgraph_providers::openai::{OpenAIModel, OpenAIModelConfig};
use flock_core::config::settings::Config;
use flock_core::types::message::TokenUsage;
use flock_tools::registry::ToolRegistry;
use flock_core::config::hooks::HookEngine;

use crate::approval::ToolApproval;
use crate::context_compression::state::CompactState;
use crate::sinks::OutputSink;
use crate::plan::state::PlanState;
use crate::session::Session;
use super::AgentEngine;

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
            cancel_flag: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Initialise a SQLite-backed checkpointer, emitting a warning and falling
    /// back to in-memory if the database cannot be opened.
    pub(crate) async fn init_checkpointer(
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
            cancel_flag: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }
}
