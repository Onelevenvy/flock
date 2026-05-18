use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Mutex;

use tokio::sync::oneshot;


/// Result of a tool approval request
pub enum ToolApprovalResult {
    Approved,
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

    pub fn approve(&self, call_id: &str, scope: ApprovalScope) {
        let pending = self
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(call_id));

        if let Some(pending) = pending {
            if matches!(scope, ApprovalScope::Always) {
                self.add_auto_approve(&pending.category);
            }
            let _ = pending.tx.send(ToolApprovalResult::Approved);
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

#[cfg(test)]
mod tests {
    use super::*;

    // --- SessionMode: default mode ---

    #[test]
    fn default_mode_does_not_auto_approve_any_category() {
        let mgr = ToolApprovalManager::new();
        assert!(!mgr.is_auto_approved("info"));
        assert!(!mgr.is_auto_approved("edit"));
        assert!(!mgr.is_auto_approved("exec"));
        assert!(!mgr.is_auto_approved("mcp"));
    }

    #[test]
    fn default_mode_current_mode_string() {
        let mgr = ToolApprovalManager::new();
        assert_eq!(mgr.current_mode(), "default");
    }

    // --- SessionMode: auto_edit mode ---

    #[test]
    fn auto_edit_mode_approves_info_and_edit() {
        let mgr = ToolApprovalManager::new();
        mgr.set_mode(SessionMode::AutoEdit);
        assert!(mgr.is_auto_approved("info"));
        assert!(mgr.is_auto_approved("edit"));
    }

    #[test]
    fn auto_edit_mode_requires_approval_for_exec_and_mcp() {
        let mgr = ToolApprovalManager::new();
        mgr.set_mode(SessionMode::AutoEdit);
        assert!(!mgr.is_auto_approved("exec"));
        assert!(!mgr.is_auto_approved("mcp"));
    }

    #[test]
    fn auto_edit_mode_current_mode_string() {
        let mgr = ToolApprovalManager::new();
        mgr.set_mode(SessionMode::AutoEdit);
        assert_eq!(mgr.current_mode(), "auto_edit");
    }

    // --- SessionMode: yolo mode ---

    #[test]
    fn yolo_mode_approves_all_categories() {
        let mgr = ToolApprovalManager::new();
        mgr.set_mode(SessionMode::Yolo);
        assert!(mgr.is_auto_approved("info"));
        assert!(mgr.is_auto_approved("edit"));
        assert!(mgr.is_auto_approved("exec"));
        assert!(mgr.is_auto_approved("mcp"));
    }

    #[test]
    fn yolo_mode_current_mode_string() {
        let mgr = ToolApprovalManager::new();
        mgr.set_mode(SessionMode::Yolo);
        assert_eq!(mgr.current_mode(), "yolo");
    }

    // --- Mode switching ---

    #[test]
    fn switching_mode_changes_approval_behavior() {
        let mgr = ToolApprovalManager::new();

        // Start in default
        assert!(!mgr.is_auto_approved("edit"));

        // Switch to auto_edit
        mgr.set_mode(SessionMode::AutoEdit);
        assert!(mgr.is_auto_approved("edit"));
        assert!(!mgr.is_auto_approved("exec"));

        // Switch to yolo
        mgr.set_mode(SessionMode::Yolo);
        assert!(mgr.is_auto_approved("exec"));

        // Switch back to default
        mgr.set_mode(SessionMode::Default);
        assert!(!mgr.is_auto_approved("edit"));
        assert!(!mgr.is_auto_approved("exec"));
    }

    // --- Mode + user "always" approval coexistence ---

    #[test]
    fn user_always_approval_persists_across_mode_changes() {
        let mgr = ToolApprovalManager::new();

        // User manually approves "exec" category with "always"
        mgr.add_auto_approve("exec");
        assert!(mgr.is_auto_approved("exec"));

        // Switch to auto_edit: exec still approved via user "always"
        mgr.set_mode(SessionMode::AutoEdit);
        assert!(mgr.is_auto_approved("exec"));
        assert!(mgr.is_auto_approved("info")); // from mode

        // Switch back to default: exec still approved via user "always"
        mgr.set_mode(SessionMode::Default);
        assert!(mgr.is_auto_approved("exec"));
        assert!(!mgr.is_auto_approved("info")); // mode no longer provides this
    }
}

pub use crate::ipc_interface::commands::*;
pub use crate::ipc_interface::events::*;
pub use crate::ipc_interface::reader::*;
pub use crate::ipc_interface::writer::*;
