// Long-term memory system for flock.
//
// Provides cross-session storage of user preferences, feedback,
// project context, and external references.

pub mod error;
pub mod index;
pub mod paths;
pub mod prompt;
pub mod store;
pub mod types;


pub use paths::*;
pub use prompt::*;
pub use store::*;
pub use types::*;
