//! Multi-level context compaction for long conversations.
//!
//! Three levels, from lightest to heaviest:
//! - **Microcompact**: clears old tool result content (no LLM call)
//! - **Autocompact**: watermark-triggered LLM summarization
//! - **Emergency**: blocks API calls when near the context window limit

pub mod auto;
pub mod emergency;
pub mod estimate;
pub mod micro;
pub mod prompt;
pub mod state;
