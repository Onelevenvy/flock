use std::path::PathBuf;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::time::Instant;
use tokio::sync::mpsc;
use flock_core::ipc_interface::approval::ToolApprovalManager;

pub enum SessionCommand {
    SendMessage { msg_id: String, content: String },
    SetConfig {
        model: Option<String>,
        thinking: Option<String>,
        thinking_budget: Option<u32>,
        effort: Option<String>,
        compaction: Option<String>,
    },
    Stop,
}

pub struct SessionHandle {
    pub tx: mpsc::Sender<SessionCommand>,
    pub workdir: PathBuf,
    pub assistant_id: Option<String>,
    pub is_running: Arc<AtomicBool>,
    pub cancel_flag: Arc<AtomicBool>,
    pub last_used: Instant,
}

/// 全局 Agent 状态
pub struct AgentState {
    pub sessions: HashMap<String, SessionHandle>,
    pub approval_manager: Arc<ToolApprovalManager>,
}

impl AgentState {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            approval_manager: Arc::new(ToolApprovalManager::new()),
        }
    }
}
