use std::fs;
use std::path::Path;
use crate::memory::error::Result;
use crate::memory::types::{MemoryEntry, MemoryFrontmatter};
use super::{FRONTMATTER_DELIM, FRONTMATTER_MAX_LINES};

/// Read a single memory file, parsing its YAML frontmatter and body.
///
/// Gracefully degrades: if the file has no valid frontmatter, returns
/// a default (empty) frontmatter with the entire file as body content.
pub fn read_memory(path: &Path) -> Result<MemoryEntry> {
    let raw = fs::read_to_string(path)?;
    let (frontmatter, content) = parse_frontmatter(&raw, Some(path));
    Ok(MemoryEntry::new(frontmatter, content))
}

/// Parse YAML frontmatter from raw file content.
///
/// Expects the format:
/// ```text
/// ---
/// name: value
/// type: user
/// ---
/// Body content here
/// ```
///
/// Returns `(frontmatter, body)`. On parse failure, returns default
/// frontmatter and the entire content as body.
pub fn parse_frontmatter(raw: &str, path: Option<&Path>) -> (MemoryFrontmatter, String) {
    let trimmed = raw.trim_start();

    // Must start with `---`
    if !trimmed.starts_with(FRONTMATTER_DELIM) {
        return (MemoryFrontmatter::default(), raw.to_owned());
    }

    // Find the closing `---`
    let after_open = &trimmed[FRONTMATTER_DELIM.len()..];

    // Skip the rest of the opening delimiter line (e.g. `---\n`)
    let after_newline = match after_open.find('\n') {
        Some(pos) => &after_open[pos + 1..],
        None => return (MemoryFrontmatter::default(), raw.to_owned()),
    };

    // Find the closing delimiter within the frontmatter max lines
    let mut search_offset = 0;
    let mut lines_seen = 0;
    let close_pos = loop {
        if lines_seen >= FRONTMATTER_MAX_LINES {
            // No closing delimiter within limit — treat as no frontmatter
            return (MemoryFrontmatter::default(), raw.to_owned());
        }
        match after_newline[search_offset..].find('\n') {
            Some(nl) => {
                let line = after_newline[search_offset..search_offset + nl].trim();
                if line == FRONTMATTER_DELIM {
                    break search_offset;
                }
                search_offset += nl + 1;
                lines_seen += 1;
            }
            None => {
                // Last line without trailing newline
                let line = after_newline[search_offset..].trim();
                if line == FRONTMATTER_DELIM {
                    break search_offset;
                }
                // No closing delimiter found
                return (MemoryFrontmatter::default(), raw.to_owned());
            }
        }
    };

    let yaml_str = &after_newline[..close_pos];
    let body_start = search_offset + FRONTMATTER_DELIM.len();
    let body = after_newline
        .get(body_start..)
        .unwrap_or("")
        .trim_start_matches('\n');

    // Parse YAML
    let frontmatter = match serde_yaml::from_str::<MemoryFrontmatter>(yaml_str) {
        Ok(fm) => fm,
        Err(e) => {
            if let Some(p) = path {
                eprintln!(
                    "warning: failed to parse frontmatter in {}: {e}",
                    p.display()
                );
            }
            MemoryFrontmatter::default()
        }
    };

    (frontmatter, body.to_owned())
}
