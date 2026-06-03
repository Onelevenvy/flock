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
