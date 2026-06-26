use std::sync::Arc;
use langgraph::prebuilt::BaseChatModel;
use flock_core::config::compression::CompressionConfig;
use flock_core::types::llm::ThinkingConfig;
use flock_tools::registry::ToolRegistry;
use crate::sinks::OutputSink;
use crate::engine::run::middleware::AgentMiddleware;

/// All infrastructure that nodes need but that is NOT part of graph state.
/// Cloned into each node closure via `Arc`.
pub struct NodeContext {
    pub provider: Arc<dyn BaseChatModel>,
    pub tools: Arc<ToolRegistry>,
    pub auto_approve: bool,
    pub allow_list: Vec<String>,
    pub compact_config: CompressionConfig,
    pub plan_config: flock_core::config::plan::PlanConfig,
    pub system_prompt: String,
    pub max_tokens: u32,
    pub thinking: Option<ThinkingConfig>,
    pub compaction_level: flock_core::context_compression::CompressionLevel,
    pub toon_enabled: bool,
    pub max_turns: Option<usize>,
    /// Output sink for streaming events — carries the same sink as the engine.
    pub output: Arc<dyn OutputSink>,
    /// Current message ID — used for output events (same value as engine's current_msg_id).
    pub msg_id: Arc<std::sync::RwLock<String>>,
    /// Shared dynamic context reminder for cache optimization.
    pub dynamic_context_reminder: Arc<std::sync::RwLock<Option<String>>>,
    /// Current session ID for plan saving.
    pub session_id: Option<String>,
    /// Shared flag for plan mode (synced with tools).
    pub plan_active_flag: Option<Arc<std::sync::atomic::AtomicBool>>,
    pub debug_mode: bool,
    pub provider_label: String,
    pub has_error: Arc<std::sync::Mutex<Option<String>>>,
    pub cancel_flag: Arc<std::sync::atomic::AtomicBool>,
    pub approval_manager: Option<Arc<flock_core::ipc_interface::approval::ToolApprovalManager>>,
    pub protocol_writer: Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>>,
    /// Middleware chain
    pub middlewares: Vec<Arc<dyn AgentMiddleware>>,
}
