use std::fmt;
use std::path::PathBuf;
use std::str::FromStr;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// The four fixed memory categories.
///
/// - `User`: role, goals, responsibilities, knowledge
/// - `Feedback`: corrections and confirmations on work approach
/// - `Project`: ongoing work context not derivable from code/git
/// - `Reference`: pointers to external systems
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryType {
    User,
    Feedback,
    Project,
    Reference,
}

impl MemoryType {
    /// All defined memory types.
    pub const ALL: [MemoryType; 4] = [
        MemoryType::User,
        MemoryType::Feedback,
        MemoryType::Project,
        MemoryType::Reference,
    ];

    /// Try to parse a string into a `MemoryType`, returning `None` for
    /// unrecognized values. This is intentionally lenient to handle
    /// legacy/hand-edited files.
    pub fn parse(s: &str) -> Option<Self> {
        s.parse().ok()
    }

    /// The lowercase string representation used in frontmatter and filenames.
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryType::User => "user",
            MemoryType::Feedback => "feedback",
            MemoryType::Project => "project",
            MemoryType::Reference => "reference",
        }
    }
}

impl fmt::Display for MemoryType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for MemoryType {
    type Err = ParseMemoryTypeError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "user" => Ok(MemoryType::User),
            "feedback" => Ok(MemoryType::Feedback),
            "project" => Ok(MemoryType::Project),
            "reference" => Ok(MemoryType::Reference),
            _ => Err(ParseMemoryTypeError(s.to_owned())),
        }
    }
}

/// Error returned when a string cannot be parsed into a [`MemoryType`].
#[derive(Debug, Clone)]
pub struct ParseMemoryTypeError(pub String);

impl fmt::Display for ParseMemoryTypeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "unknown memory type: {:?}", self.0)
    }
}

impl std::error::Error for ParseMemoryTypeError {}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/// YAML frontmatter parsed from a memory file header.
///
/// All fields are optional to handle incomplete or legacy files gracefully.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryFrontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub memory_type: Option<MemoryType>,
}

// ---------------------------------------------------------------------------
// Header (lightweight metadata returned by directory scans)
// ---------------------------------------------------------------------------

/// Lightweight metadata for a memory file, extracted without reading
/// the full body. Used by directory scans and manifest formatting.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoryHeader {
    /// Filename (without directory), e.g. `user_role.md`.
    pub filename: String,
    /// Full path to the file.
    pub file_path: PathBuf,
    /// Last modification time.
    pub mtime: DateTime<Utc>,
    /// One-line description from frontmatter (may be absent).
    pub description: Option<String>,
    /// Memory type from frontmatter (may be absent).
    pub memory_type: Option<MemoryType>,
}

// ---------------------------------------------------------------------------
// Entry (full memory content)
// ---------------------------------------------------------------------------

/// A complete memory entry: metadata + body content.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoryEntry {
    pub frontmatter: MemoryFrontmatter,
    pub content: String,
}

impl MemoryEntry {
    /// Create a new entry with the given frontmatter and body content.
    pub fn new(frontmatter: MemoryFrontmatter, content: String) -> Self {
        Self {
            frontmatter,
            content,
        }
    }

    /// Convenience constructor for a fully specified entry.
    pub fn build(
        name: impl Into<String>,
        description: impl Into<String>,
        memory_type: MemoryType,
        content: impl Into<String>,
    ) -> Self {
        Self {
            frontmatter: MemoryFrontmatter {
                name: Some(name.into()),
                description: Some(description.into()),
                memory_type: Some(memory_type),
            },
            content: content.into(),
        }
    }
}

// ---------------------------------------------------------------------------
// Index truncation result
// ---------------------------------------------------------------------------

/// Result of truncating MEMORY.md content.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndexTruncation {
    /// The (possibly truncated) content.
    pub content: String,
    /// Number of lines in the original (pre-truncation) content.
    pub line_count: usize,
    /// Byte count of the original (pre-truncation) content.
    pub byte_count: usize,
    /// Whether any truncation was applied.
    pub was_truncated: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    // -- MemoryType::parse --------------------------------------------------

    #[test]
    fn parse_valid_types() {
        assert_eq!(MemoryType::parse("user"), Some(MemoryType::User));
        assert_eq!(MemoryType::parse("feedback"), Some(MemoryType::Feedback));
        assert_eq!(MemoryType::parse("project"), Some(MemoryType::Project));
        assert_eq!(MemoryType::parse("reference"), Some(MemoryType::Reference));
    }

    #[test]
    fn parse_invalid_returns_none() {
        assert_eq!(MemoryType::parse("invalid"), None);
        assert_eq!(MemoryType::parse(""), None);
        assert_eq!(MemoryType::parse("User"), None); // case-sensitive
        assert_eq!(MemoryType::parse("USER"), None);
        assert_eq!(MemoryType::parse("Feedback"), None);
    }

    // -- Display + FromStr roundtrip ----------------------------------------

    #[test]
    fn display_roundtrip() {
        for ty in MemoryType::ALL {
            let s = ty.to_string();
            let parsed: MemoryType = s.parse().unwrap();
            assert_eq!(parsed, ty);
        }
    }

    #[test]
    fn display_is_lowercase() {
        assert_eq!(MemoryType::User.to_string(), "user");
        assert_eq!(MemoryType::Feedback.to_string(), "feedback");
        assert_eq!(MemoryType::Project.to_string(), "project");
        assert_eq!(MemoryType::Reference.to_string(), "reference");
    }

    // -- Serde roundtrip ----------------------------------------------------

    #[test]
    fn serde_yaml_roundtrip() {
        for ty in MemoryType::ALL {
            let yaml = serde_yaml::to_string(&ty).unwrap();
            let parsed: MemoryType = serde_yaml::from_str(&yaml).unwrap();
            assert_eq!(parsed, ty);
        }
    }

    #[test]
    fn serde_yaml_serializes_lowercase() {
        let yaml = serde_yaml::to_string(&MemoryType::User).unwrap();
        assert_eq!(yaml.trim(), "user");
    }

    #[test]
    fn serde_yaml_rejects_uppercase() {
        let result: Result<MemoryType, _> = serde_yaml::from_str("User");
        assert!(result.is_err());
    }

    // -- MemoryFrontmatter --------------------------------------------------

    #[test]
    fn frontmatter_deserialize_full() {
        let yaml = "name: test\ndescription: a test\ntype: feedback\n";
        let fm: MemoryFrontmatter = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(fm.name.as_deref(), Some("test"));
        assert_eq!(fm.description.as_deref(), Some("a test"));
        assert_eq!(fm.memory_type, Some(MemoryType::Feedback));
    }

    #[test]
    fn frontmatter_deserialize_partial() {
        let yaml = "name: partial\n";
        let fm: MemoryFrontmatter = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(fm.name.as_deref(), Some("partial"));
        assert_eq!(fm.description, None);
        assert_eq!(fm.memory_type, None);
    }

    #[test]
    fn frontmatter_deserialize_empty() {
        let fm: MemoryFrontmatter = serde_yaml::from_str("{}").unwrap();
        assert_eq!(fm, MemoryFrontmatter::default());
    }

    #[test]
    fn frontmatter_serialize_roundtrip() {
        let fm = MemoryFrontmatter {
            name: Some("my memory".into()),
            description: Some("desc".into()),
            memory_type: Some(MemoryType::Project),
        };
        let yaml = serde_yaml::to_string(&fm).unwrap();
        let parsed: MemoryFrontmatter = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(parsed, fm);
    }

    // -- MemoryEntry --------------------------------------------------------

    #[test]
    fn entry_build_convenience() {
        let entry = MemoryEntry::build("name", "desc", MemoryType::User, "body");
        assert_eq!(entry.frontmatter.name.as_deref(), Some("name"));
        assert_eq!(entry.frontmatter.description.as_deref(), Some("desc"));
        assert_eq!(entry.frontmatter.memory_type, Some(MemoryType::User));
        assert_eq!(entry.content, "body");
    }

    // -- MemoryType::ALL covers all variants --------------------------------

    #[test]
    fn all_constant_is_exhaustive() {
        assert_eq!(MemoryType::ALL.len(), 4);
        // Ensure no duplicates
        let mut seen = std::collections::HashSet::new();
        for ty in MemoryType::ALL {
            assert!(seen.insert(ty), "duplicate in ALL: {ty}");
        }
    }

    // -- ParseMemoryTypeError -----------------------------------------------

    #[test]
    fn parse_error_displays_value() {
        let err = ParseMemoryTypeError("bad".into());
        let msg = err.to_string();
        assert!(msg.contains("bad"), "error should mention the bad value");
    }
}
