use std::fs;
use std::path::{Path, PathBuf};
use crate::memory::error::Result;
use crate::memory::types::{MemoryEntry, MemoryFrontmatter};
use super::FRONTMATTER_DELIM;

/// Write a memory entry to a file in `dir`.
///
/// The filename is derived from the entry's type and name:
/// `<type>_<sanitized_name>.md`. Returns the full path of the written file.
///
/// Creates the directory if it doesn't exist.
pub fn write_memory(dir: &Path, entry: &MemoryEntry) -> Result<PathBuf> {
    fs::create_dir_all(dir)?;

    let filename = generate_filename(&entry.frontmatter);
    let path = dir.join(&filename);

    let content = serialize_entry(entry);
    fs::write(&path, content)?;

    Ok(path)
}

/// Serialize a memory entry into the frontmatter + body format.
fn serialize_entry(entry: &MemoryEntry) -> String {
    let yaml = serde_yaml::to_string(&entry.frontmatter).unwrap_or_default();
    // serde_yaml adds a trailing newline; trim it for consistent formatting
    let yaml = yaml.trim_end();

    format!(
        "{FRONTMATTER_DELIM}\n{yaml}\n{FRONTMATTER_DELIM}\n\n{}",
        entry.content
    )
}

/// Generate a safe filename from an entry's frontmatter.
///
/// Format: `<type>_<sanitized_name>.md`
/// Falls back to `memory_<hash>.md` if name is empty.
fn generate_filename(fm: &MemoryFrontmatter) -> String {
    let type_prefix = fm
        .memory_type
        .map(|t| t.as_str().to_owned())
        .unwrap_or_else(|| "memory".to_owned());

    let name_part = fm
        .name
        .as_deref()
        .filter(|n| !n.trim().is_empty())
        .map(sanitize_filename)
        .filter(|s| !s.is_empty()) // pure non-ASCII names sanitize to empty
        .unwrap_or_else(|| {
            // Use a simple hash of the current time as fallback
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            format!("{now:x}")
        });

    format!("{type_prefix}_{name_part}.md")
}

/// Sanitize a string for use as part of a filename.
///
/// Converts to lowercase, replaces non-alphanumeric chars with underscores,
/// collapses consecutive underscores, and trims leading/trailing underscores.
fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect();

    // Collapse consecutive underscores
    let mut result = String::with_capacity(sanitized.len());
    let mut prev_underscore = false;
    for c in sanitized.chars() {
        if c == '_' {
            if !prev_underscore {
                result.push(c);
            }
            prev_underscore = true;
        } else {
            result.push(c);
            prev_underscore = false;
        }
    }

    // Trim leading/trailing underscores
    result.trim_matches('_').to_owned()
}
