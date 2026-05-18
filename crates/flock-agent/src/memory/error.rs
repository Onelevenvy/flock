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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_error_display() {
        let inner = std::io::Error::new(std::io::ErrorKind::NotFound, "gone");
        let err = MemoryError::Io(inner);
        let msg = err.to_string();
        assert!(msg.contains("I/O"), "should mention I/O: {msg}");
        assert!(msg.contains("gone"), "should contain inner message: {msg}");
    }

    #[test]
    fn io_error_from_conversion() {
        let inner = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied");
        let err: MemoryError = inner.into();
        assert!(matches!(err, MemoryError::Io(_)));
    }

    #[test]
    fn path_validation_display() {
        let err = MemoryError::PathValidation("relative path".into());
        let msg = err.to_string();
        assert!(
            msg.contains("relative path"),
            "should contain reason: {msg}"
        );
        assert!(
            msg.contains("validation"),
            "should mention validation: {msg}"
        );
    }

    #[test]
    fn frontmatter_parse_display() {
        // Trigger a real serde_yaml error
        let yaml_err = serde_yaml::from_str::<serde_yaml::Value>(":\n  :\n---").unwrap_err();
        let err = MemoryError::FrontmatterParse {
            path: PathBuf::from("/tmp/test.md"),
            source: yaml_err,
        };
        let msg = err.to_string();
        assert!(msg.contains("/tmp/test.md"), "should contain path: {msg}");
        assert!(
            msg.contains("frontmatter"),
            "should mention frontmatter: {msg}"
        );
    }
}
