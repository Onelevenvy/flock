use std::path::PathBuf;

/// Errors that can occur within the memory system.
#[derive(Debug, thiserror::Error)]
pub enum MemoryError {
    /// File I/O error.
    #[error("memory I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// YAML frontmatter failed to parse.
    #[error("failed to parse frontmatter in {path}: {source}")]
    FrontmatterParse {
        path: PathBuf,
        source: serde_yaml::Error,
    },

    /// Memory path failed security validation.
    #[error("path validation failed: {0}")]
    PathValidation(String),
}

pub type Result<T> = std::result::Result<T, MemoryError>;

