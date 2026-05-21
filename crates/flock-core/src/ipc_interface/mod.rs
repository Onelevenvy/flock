// JSON stream ipc_interface for host ↔ agent communication.
// Contains: events (agent→host), commands (host→agent), approval manager.

pub mod commands;
pub mod events;
pub mod reader;
pub mod writer;
pub mod approval;

