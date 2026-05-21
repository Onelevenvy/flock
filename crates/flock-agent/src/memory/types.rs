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
