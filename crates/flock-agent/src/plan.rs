// Plan Mode: state management, tool implementations, prompts, and file I/O.
//
// Plan Mode restricts the agent to read-only tools while composing an
// implementation plan.  After the plan is ready the agent exits plan mode
// and regains full tool access.

pub mod file;
pub mod prompt;
pub mod state;
