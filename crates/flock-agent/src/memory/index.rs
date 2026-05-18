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

#[cfg(test)]
mod tests {
    use super::*;

    // -- format_size ----------------------------------------------------------

    #[test]
    fn format_size_bytes() {
        assert_eq!(format_size(500), "500 B");
    }

    #[test]
    fn format_size_kilobytes() {
        assert_eq!(format_size(25_000), "24.4 KB");
    }

    #[test]
    fn format_size_zero() {
        assert_eq!(format_size(0), "0 B");
    }

    // -- truncate_index: no truncation ----------------------------------------

    #[test]
    fn no_truncation_small_content() {
        let content = "- [A](a.md) — summary\n- [B](b.md) — summary\n";
        let result = truncate_index(content);
        assert!(!result.was_truncated);
        assert_eq!(result.line_count, 2);
        assert_eq!(result.content, content.trim());
    }

    #[test]
    fn no_truncation_empty() {
        let result = truncate_index("");
        assert!(!result.was_truncated);
        assert_eq!(result.line_count, 0);
        assert_eq!(result.byte_count, 0);
        assert_eq!(result.content, "");
    }

    #[test]
    fn no_truncation_whitespace_only() {
        let result = truncate_index("   \n  \n  ");
        assert!(!result.was_truncated);
        assert_eq!(result.content, "");
    }

    #[test]
    fn no_truncation_exactly_200_lines() {
        let content = (0..200)
            .map(|i| format!("- line {i}"))
            .collect::<Vec<_>>()
            .join("\n");
        let result = truncate_index(&content);
        assert!(!result.was_truncated);
        assert_eq!(result.line_count, 200);
    }

    #[test]
    fn no_truncation_exactly_25000_bytes() {
        // 100 lines (under 200 limit) totalling exactly 25000 bytes.
        // 100 lines joined by 99 newlines: each line = (25000 - 99) / 100 = 249 chars,
        // remainder 1 added to last line.
        let per_line = (MAX_INDEX_BYTES - 99) / 100; // 249
        let remainder = MAX_INDEX_BYTES - 99 - per_line * 100;
        let mut lines: Vec<String> = (0..100).map(|_| "x".repeat(per_line)).collect();
        if remainder > 0 {
            lines.last_mut().unwrap().push_str(&"x".repeat(remainder));
        }
        let content = lines.join("\n");
        assert_eq!(content.len(), MAX_INDEX_BYTES);
        let result = truncate_index(&content);
        assert!(!result.was_truncated);
    }

    // -- truncate_index: line truncation --------------------------------------

    #[test]
    fn line_truncation_250_lines() {
        let lines: Vec<String> = (0..250).map(|i| format!("- line {i}")).collect();
        let content = lines.join("\n");
        let result = truncate_index(&content);

        assert!(result.was_truncated);
        assert_eq!(result.line_count, 250);
        // Content should contain only first 200 lines (before warning)
        let content_before_warning = result.content.split("\n\n> WARNING:").next().unwrap();
        let output_lines: Vec<&str> = content_before_warning.split('\n').collect();
        assert_eq!(output_lines.len(), 200);
        assert!(result.content.contains("250 lines"));
        assert!(result.content.contains("WARNING"));
    }

    #[test]
    fn line_truncation_201_lines() {
        let lines: Vec<String> = (0..201).map(|i| format!("- line {i}")).collect();
        let content = lines.join("\n");
        let result = truncate_index(&content);

        assert!(result.was_truncated);
        assert_eq!(result.line_count, 201);
    }

    // -- truncate_index: byte truncation --------------------------------------

    #[test]
    fn byte_truncation_long_lines() {
        // 100 lines, each 300 bytes = 30000 bytes > 25000
        let lines: Vec<String> = (0..100)
            .map(|i| format!("{i:03}: {}", "x".repeat(296)))
            .collect();
        let content = lines.join("\n");
        assert!(content.len() > MAX_INDEX_BYTES);

        let result = truncate_index(&content);
        assert!(result.was_truncated);
        assert_eq!(result.line_count, 100);
        // Warning should mention byte size, not line count
        assert!(result.content.contains("index entries are too long"));
    }

    #[test]
    fn byte_truncation_cuts_at_newline() {
        // Create content just over the byte limit
        let line = "a".repeat(250);
        let lines: Vec<String> = (0..110).map(|_| line.clone()).collect();
        let content = lines.join("\n");
        assert!(content.len() > MAX_INDEX_BYTES);

        let result = truncate_index(&content);
        assert!(result.was_truncated);

        // Content before warning should end at a line boundary
        let before_warning = result.content.split("\n\n> WARNING:").next().unwrap();
        // Every line should be complete (not cut mid-content)
        for line in before_warning.lines() {
            assert!(
                line.len() == 250 || line.is_empty(),
                "unexpected line length: {} for {:?}",
                line.len(),
                &line[..line.len().min(40)]
            );
        }
    }

    // -- truncate_index: both limits ------------------------------------------

    #[test]
    fn both_line_and_byte_truncation() {
        // 300 lines of 200 bytes each = 60000 bytes; both limits exceeded
        let lines: Vec<String> = (0..300)
            .map(|i| format!("{i:03}: {}", "y".repeat(196)))
            .collect();
        let content = lines.join("\n");

        let result = truncate_index(&content);
        assert!(result.was_truncated);
        assert_eq!(result.line_count, 300);
        // Warning should mention both lines and bytes
        assert!(result.content.contains("300 lines"));
        assert!(result.content.contains("KB"));
    }

    // -- truncate_index: single long line (no newline to cut at) ---------------

    #[test]
    fn single_long_line_fallback() {
        let content = "z".repeat(30_000);
        let result = truncate_index(&content);

        assert!(result.was_truncated);
        // Should truncate at MAX_INDEX_BYTES
        let before_warning = result.content.split("\n\n> WARNING:").next().unwrap();
        assert_eq!(before_warning.len(), MAX_INDEX_BYTES);
    }

    // -- truncate_index: preserves content integrity ---------------------------

    #[test]
    fn truncation_preserves_first_200_lines() {
        let lines: Vec<String> = (0..250)
            .map(|i| format!("- [{i}](file_{i}.md) \u{2014} memory number {i}"))
            .collect();
        let content = lines.join("\n");
        let result = truncate_index(&content);

        // First line should be present
        assert!(result.content.contains("- [0](file_0.md)"));
        // Line 199 should be present
        assert!(result.content.contains("- [199](file_199.md)"));
        // Line 200 should NOT be present (0-indexed, so that's the 201st)
        assert!(!result.content.contains("- [200](file_200.md)"));
    }

    // -- append entry (unit-level, using temp files) --------------------------

    #[test]
    fn append_to_new_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");

        append_index_entry(&path, "Role", "user_role.md", "user role info").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "- [Role](user_role.md) \u{2014} user role info\n");
    }

    #[test]
    fn append_to_existing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");
        fs::write(&path, "- [A](a.md) \u{2014} first\n").unwrap();

        append_index_entry(&path, "B", "b.md", "second").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(
            content,
            "- [A](a.md) \u{2014} first\n- [B](b.md) \u{2014} second\n"
        );
    }

    #[test]
    fn append_to_file_without_trailing_newline() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");
        fs::write(&path, "- [A](a.md) \u{2014} first").unwrap();

        append_index_entry(&path, "B", "b.md", "second").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        // Should have a newline between entries
        assert!(content.contains("first\n- [B]"));
    }

    #[test]
    fn append_creates_parent_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("sub").join("dir").join("MEMORY.md");

        append_index_entry(&path, "Test", "test.md", "testing").unwrap();
        assert!(path.exists());
    }

    // -- remove entry (unit-level, using temp files) --------------------------

    #[test]
    fn remove_existing_entry() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");
        fs::write(
            &path,
            "- [A](a.md) \u{2014} first\n- [B](b.md) \u{2014} second\n- [C](c.md) \u{2014} third\n",
        )
        .unwrap();

        remove_index_entry(&path, "b.md").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(
            content,
            "- [A](a.md) \u{2014} first\n- [C](c.md) \u{2014} third\n"
        );
    }

    #[test]
    fn remove_nonexistent_entry_is_noop() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");
        let original = "- [A](a.md) \u{2014} first\n";
        fs::write(&path, original).unwrap();

        remove_index_entry(&path, "nonexistent.md").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, original);
    }

    #[test]
    fn remove_from_nonexistent_file_is_ok() {
        let path = Path::new("/nonexistent/MEMORY.md");
        // Should not error
        remove_index_entry(path, "anything.md").unwrap();
    }

    #[test]
    fn remove_last_entry_leaves_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");
        fs::write(&path, "- [A](a.md) \u{2014} only\n").unwrap();

        remove_index_entry(&path, "a.md").unwrap();

        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "");
    }

    // -- read_index (unit-level) ----------------------------------------------

    #[test]
    fn read_nonexistent_returns_empty() {
        let result = read_index(Path::new("/nonexistent/MEMORY.md"));
        assert_eq!(result, "");
    }

    #[test]
    fn read_existing_returns_content() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("MEMORY.md");
        fs::write(&path, "# Index\n- [A](a.md)\n").unwrap();

        let result = read_index(&path);
        assert_eq!(result, "# Index\n- [A](a.md)\n");
    }
}
