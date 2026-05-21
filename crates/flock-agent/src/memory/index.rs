// MEMORY.md index management and truncation.
//
// The index file (`MEMORY.md`) is a lightweight directory of all memory
// topic files.  Each entry is a single Markdown link line:
//
//     - [Title](filename.md) — one-line summary
//
// The index has hard caps (lines and bytes) to prevent unbounded growth.

use std::fs;
use std::path::Path;

use crate::memory::error::Result;
use crate::memory::types::IndexTruncation;

/// Maximum number of lines before truncation.
pub const MAX_INDEX_LINES: usize = 200;

/// Maximum byte count before truncation (~25 KB).
pub const MAX_INDEX_BYTES: usize = 25_000;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/// Read the MEMORY.md index file at `path`.
///
/// Returns the raw content as a string.  If the file does not exist or
/// cannot be read, returns an empty string (silent fallback — the index
/// is informational and its absence is not an error).
pub fn read_index(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

/// Truncate index content to the line AND byte caps.
///
/// Algorithm:
/// 1. Trim whitespace from both ends.
/// 2. Check original line count and byte count against limits.
/// 3. If within both limits, return as-is.
/// 4. Line-truncate first (slice to first `MAX_INDEX_LINES` lines).
/// 5. If still over `MAX_INDEX_BYTES`, byte-truncate at the last newline
///    before the cap so we never cut mid-line.
/// 6. Append a diagnostic warning naming which cap(s) fired.
pub fn truncate_index(raw: &str) -> IndexTruncation {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return IndexTruncation {
            content: String::new(),
            line_count: 0,
            byte_count: 0,
            was_truncated: false,
        };
    }

    let lines: Vec<&str> = trimmed.split('\n').collect();
    let line_count = lines.len();
    let byte_count = trimmed.len();

    let was_line_truncated = line_count > MAX_INDEX_LINES;
    // Check original byte count — long lines are the failure mode the
    // byte cap targets, so post-line-truncation size would understate.
    let was_byte_truncated = byte_count > MAX_INDEX_BYTES;

    if !was_line_truncated && !was_byte_truncated {
        return IndexTruncation {
            content: trimmed.to_owned(),
            line_count,
            byte_count,
            was_truncated: false,
        };
    }

    // Step 1: line truncation
    let mut truncated = if was_line_truncated {
        lines[..MAX_INDEX_LINES].join("\n")
    } else {
        trimmed.to_owned()
    };

    // Step 2: byte truncation (on the possibly line-truncated result)
    if truncated.len() > MAX_INDEX_BYTES {
        let cut_at = truncated[..MAX_INDEX_BYTES]
            .rfind('\n')
            .filter(|&pos| pos > 0);
        let boundary = cut_at.unwrap_or(MAX_INDEX_BYTES);
        truncated.truncate(boundary);
    }

    // Build the warning message
    let reason = match (was_line_truncated, was_byte_truncated) {
        (true, false) => format!("{line_count} lines (limit: {MAX_INDEX_LINES})"),
        (false, true) => format!(
            "{} (limit: {}) \u{2014} index entries are too long",
            format_size(byte_count),
            format_size(MAX_INDEX_BYTES),
        ),
        _ => format!("{line_count} lines and {}", format_size(byte_count),),
    };

    truncated.push_str(&format!(
        "\n\n> WARNING: MEMORY.md is {reason}. \
         Only part of it was loaded. \
         Keep index entries to one line under ~200 chars; \
         move detail into topic files."
    ));

    IndexTruncation {
        content: truncated,
        line_count,
        byte_count,
        was_truncated: true,
    }
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/// Append an entry to the MEMORY.md index file.
///
/// Format: `- [title](filename) — summary`
///
/// Creates the file (and parent directories) if it doesn't exist.
/// Ensures a newline separator before the new entry.
pub fn append_index_entry(path: &Path, title: &str, filename: &str, summary: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let entry = format!("- [{title}]({filename}) \u{2014} {summary}");

    let mut content = fs::read_to_string(path).unwrap_or_default();
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&entry);
    content.push('\n');

    fs::write(path, content)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

/// Remove the index entry that references `filename`.
///
/// Scans the index for any line containing `(filename)` and removes it.
/// Idempotent — silently succeeds if the file doesn't exist or the
/// entry is not found.
pub fn remove_index_entry(path: &Path, filename: &str) -> Result<()> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };

    let needle = format!("({filename})");
    let filtered: Vec<&str> = content
        .lines()
        .filter(|line| !line.contains(&needle))
        .collect();

    // Preserve trailing newline if original had one
    let mut result = filtered.join("\n");
    if !result.is_empty() {
        result.push('\n');
    }

    fs::write(path, result)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Format a byte count as a human-readable size string.
fn format_size(bytes: usize) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else {
        let kb = bytes as f64 / 1024.0;
        format!("{kb:.1} KB")
    }
}

// ===========================================================================
// Unit tests
// ===========================================================================
