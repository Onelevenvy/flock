use std::path::PathBuf;
use std::sync::Arc;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use flock_core::ipc_interface::approval::ToolApprovalManager;

pub struct SessionMetadata {
    pub workdir: PathBuf,
    pub assistant_id: Option<String>,
    pub extra_args: Vec<String>,
}

pub struct ActiveSession {
    pub join_handle: tokio::task::JoinHandle<()>,
    pub cancel_flag: Arc<AtomicBool>,
    pub is_running: Arc<AtomicBool>,
    pub msg_id: String,
}

/// 全局 Agent 状态
pub struct AgentState {
    pub sessions: HashMap<String, ActiveSession>,
    pub metadata: HashMap<String, SessionMetadata>,
    pub approval_manager: Arc<ToolApprovalManager>,
}

impl AgentState {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            metadata: HashMap::new(),
            approval_manager: Arc::new(ToolApprovalManager::new()),
        }
    }
}
