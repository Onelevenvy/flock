use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Mutex;

use tokio::sync::oneshot;


/// Result of a tool approval request
pub enum ToolApprovalResult {
    Approved { feedback: Option<String> },
    Denied { reason: String },
}

struct PendingApproval {
    tx: oneshot::Sender<ToolApprovalResult>,
    category: String,
}

/// Manages pending tool approval requests using oneshot channels.
///
/// Each pending request also stores its tool category so a client approval with
/// `ApprovalScope::Always` can persist auto-approval for future requests in the
/// same category.
///
/// Also holds the current `SessionMode` which determines which tool categories
/// are auto-approved based on the active approval policy.
pub struct ToolApprovalManager {
    pending: Mutex<HashMap<String, PendingApproval>>,
    auto_approved: Mutex<HashSet<String>>,
    session_mode: Mutex<SessionMode>,
}

impl ToolApprovalManager {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
            auto_approved: Mutex::new(HashSet::new()),
            session_mode: Mutex::new(SessionMode::Default),
        }
    }

    pub fn request_approval(
        &self,
        call_id: &str,
        category: &ToolCategory,
    ) -> oneshot::Receiver<ToolApprovalResult> {
        let (tx, rx) = oneshot::channel();
        if let Ok(mut pending) = self.pending.lock() {
            pending.insert(
                call_id.to_string(),
                PendingApproval {
                    tx,
                    category: category.to_string(),
                },
            );
        }
        rx
    }

    pub fn approve(&self, call_id: &str, scope: ApprovalScope, feedback: Option<String>) {
        let pending = self
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(call_id));

        if let Some(pending) = pending {
            if matches!(scope, ApprovalScope::Always) {
                self.add_auto_approve(&pending.category);
            }
            let _ = pending.tx.send(ToolApprovalResult::Approved { feedback });
        }
    }

    pub fn resolve(&self, call_id: &str, result: ToolApprovalResult) {
        if let Some(pending) = self
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(call_id))
        {
            let _ = pending.tx.send(result);
        }
    }

    pub fn is_auto_approved(&self, category: &str) -> bool {
        // Check session mode first
        let mode_approved = self
            .session_mode
            .lock()
            .map(|mode| match *mode {
                SessionMode::Yolo => true,
                SessionMode::AutoEdit => category == "info" || category == "edit",
                SessionMode::Default => false,
            })
            .unwrap_or(false);

        if mode_approved {
            return true;
        }

        // Fall back to per-category "always" approvals
        self.auto_approved
            .lock()
            .map(|auto| auto.contains(category))
            .unwrap_or(false)
    }

    /// Set the session approval mode. Takes effect immediately.
    pub fn set_mode(&self, mode: SessionMode) {
        if let Ok(mut current) = self.session_mode.lock() {
            *current = mode;
        }
    }

    /// Return the current session mode as a string for capability reporting.
    pub fn current_mode(&self) -> String {
        self.session_mode
            .lock()
            .map(|mode| match *mode {
                SessionMode::Default => "default",
                SessionMode::AutoEdit => "auto_edit",
                SessionMode::Yolo => "yolo",
            })
            .unwrap_or("default")
            .to_string()
    }

    pub fn drop_pending(&self, call_id: &str) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(call_id);
        }
    }

    pub fn add_auto_approve(&self, category: &str) {
        if let Ok(mut auto) = self.auto_approved.lock() {
            auto.insert(category.to_string());
        }
    }
}

impl Default for ToolApprovalManager {
    fn default() -> Self {
        Self::new()
    }
}

pub use crate::ipc_interface::commands::*;
pub use crate::ipc_interface::events::*;
pub use crate::ipc_interface::reader::*;
pub use crate::ipc_interface::writer::*;
