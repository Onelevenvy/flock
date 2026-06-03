#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApprovalDecision {
    Approved,
    Denied,
    Quit,
}

pub trait ToolConfirmer: Send + Sync {
    fn check(&mut self, tool_name: &str, tool_input_display: &str) -> ApprovalDecision;
    fn requires_approval(&self, tool_name: &str) -> bool;
}
