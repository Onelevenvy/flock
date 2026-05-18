// Core agent infrastructure: engine, session, orchestration, output sinks.

pub mod agents_md;
pub mod agent_setup;
pub mod cache_diagnostics;
pub mod context_compression;
pub mod approval;
pub mod context;
pub mod engine;
pub mod graph;
pub mod tool_executor;
pub mod output;
pub mod plan;
pub mod session;
pub mod tools;

pub mod spawner;
pub mod http_recording;

// Re-export the skills crate so existing callers (flock-cli, tests) can use
// `crate::skills::` without changing their import paths.
pub use flock_skills as skills;
pub mod memory;
