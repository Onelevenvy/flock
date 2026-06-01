mod emitter;
mod state;
mod actor;
mod lifecycle;
mod commands;

pub use emitter::TauriProtocolEmitter;
pub use state::AgentState;
pub use lifecycle::{start_agent, stop_agent, send_message};
pub use commands::{approve_tool, deny_tool, set_mode, set_config};
