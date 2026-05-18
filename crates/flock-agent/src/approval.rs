use std::collections::HashSet;
use std::io::{self, BufRead, Write};

pub struct ToolApproval {
    auto_approve: bool,
    allow_list: HashSet<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApprovalDecision {
    Approved,
    Denied,
    Quit,
}

impl ToolApproval {
    pub fn new(auto_approve: bool, allow_list: Vec<String>) -> Self {
        Self {
            auto_approve,
            allow_list: allow_list.into_iter().collect(),
        }
    }

    /// Returns whether auto-approve is enabled
    pub fn is_auto_approve(&self) -> bool {
        self.auto_approve
    }

    /// Add a tool name to the allow list at runtime.
    /// Used by skill context modifiers to grant auto-approval for specified tools.
    pub fn add_to_allow_list(&mut self, name: &str) {
        self.allow_list.insert(name.to_string());
    }

    /// Check if the tool needs confirmation without prompting the user.
    pub fn requires_approval(&self, tool_name: &str) -> bool {
        !self.auto_approve && !self.allow_list.contains(tool_name)
    }

    /// Check if the tool needs confirmation. Returns the user's decision.
    pub fn check(&mut self, tool_name: &str, tool_input_display: &str) -> ApprovalDecision {
        if !self.requires_approval(tool_name) {
            return ApprovalDecision::Approved;
        }

        eprint!(
            "\n[tool] {}({})\nAllow? [y]es / [n]o / [a]lways / [q]uit > ",
            tool_name, tool_input_display
        );
        io::stderr().flush().unwrap();

        let mut input = String::new();
        if io::stdin().lock().read_line(&mut input).is_err() {
            return ApprovalDecision::Denied;
        }

        match input.trim().to_lowercase().as_str() {
            "y" | "yes" | "" => ApprovalDecision::Approved,
            "a" | "always" => {
                self.allow_list.insert(tool_name.to_string());
                ApprovalDecision::Approved
            }
            "q" | "quit" => ApprovalDecision::Quit,
            _ => ApprovalDecision::Denied,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auto_approve_always_allows() {
        let mut confirmer = ToolApproval::new(true, vec![]);
        assert_eq!(
            confirmer.check("Bash", "echo hello"),
            ApprovalDecision::Approved
        );
        assert_eq!(
            confirmer.check("Read", "/tmp/file"),
            ApprovalDecision::Approved
        );
        assert_eq!(
            confirmer.check("Write", "/tmp/out"),
            ApprovalDecision::Approved
        );
    }

    #[test]
    fn test_allowlist_contains_tool() {
        let mut confirmer = ToolApproval::new(false, vec!["Read".into(), "Write".into()]);
        assert_eq!(
            confirmer.check("Read", "/tmp/file"),
            ApprovalDecision::Approved
        );
        assert_eq!(
            confirmer.check("Write", "/tmp/out"),
            ApprovalDecision::Approved
        );
    }

    #[test]
    fn test_allowlist_approves_even_when_auto_approve_is_false() {
        let mut confirmer = ToolApproval::new(false, vec!["Read".into()]);
        assert_eq!(
            confirmer.check("Read", "/some/path"),
            ApprovalDecision::Approved
        );
    }

    // Phase 6: add_to_allow_list() grants runtime approval
    #[test]
    fn test_add_to_allow_list_grants_approval() {
        let mut confirmer = ToolApproval::new(false, vec![]);
        // Before: tool not in list (would prompt — skip interactive check, just verify membership)
        confirmer.add_to_allow_list("Write");
        // After: auto-approved without interactive prompt
        assert_eq!(
            confirmer.check("Write", "file.txt"),
            ApprovalDecision::Approved
        );
    }

    // Phase 6: add_to_allow_list() is idempotent — adding twice has no bad effect
    #[test]
    fn test_add_to_allow_list_idempotent() {
        let mut confirmer = ToolApproval::new(false, vec![]);
        confirmer.add_to_allow_list("Bash");
        confirmer.add_to_allow_list("Bash"); // duplicate — HashSet, no panic
        assert_eq!(confirmer.check("Bash", "echo hi"), ApprovalDecision::Approved);
    }

    // Phase 6: add_to_allow_list() does not affect unrelated tools
    #[test]
    fn test_add_to_allow_list_does_not_affect_other_tools() {
        let mut confirmer = ToolApproval::new(false, vec![]);
        confirmer.add_to_allow_list("Read");
        // Write is not in the list — check returns non-Approved for non-interactive
        // (we cannot test interactive input; verify Read is approved and Write is not in list)
        assert_eq!(confirmer.check("Read", "file.txt"), ApprovalDecision::Approved);
        // We can't test the Denied path without stdin, but we verify allow_list state:
        assert!(confirmer.allow_list.contains("Read"));
        assert!(!confirmer.allow_list.contains("Write"));
    }
}
