//! Graph state for the flock workflow agent.
//!
//! Using `#[langgraph_state]` automates StateGraph channels generation.

use langgraph_derive::langgraph_state;
pub use langgraph_derive::StateGraph;
use serde_json::Value as JsonValue;

#[langgraph_state]
#[derive(Debug)]
pub struct WorkflowState {
    /// Initial user input message
    #[channel]
    pub input_msg: String,

    /// Message list (history)
    #[channel(messages)]
    pub messages: Vec<JsonValue>,

    /// Node output dictionary (Map<node_id, Value>)
    #[channel]
    pub node_outputs: JsonValue,

    /// Current executing node ID
    #[channel]
    pub current_node: String,

    /// Shutdown requested
    #[channel]
    pub quit_requested: bool,

    /// Environment variables defined at workflow level
    #[channel]
    pub env_vars: JsonValue,
}
