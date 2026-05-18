// Memory file read, write, delete, scan, and manifest formatting.
//
// This module handles the file-level operations for memory persistence:
// parsing YAML frontmatter, writing memory entries, scanning directories
// for memory headers, and formatting manifests.

use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};

use chrono::{DateTime, TimeZone, Utc};

use crate::memory::error::Result;
use crate::memory::paths::ENTRYPOINT_NAME;
use crate::memory::types::{MemoryEntry, MemoryFrontmatter, MemoryHeader};

/// Maximum number of lines to read when extracting frontmatter.
const FRONTMATTER_MAX_LINES: usize = 30;

/// Maximum number of files returned by a directory scan.
const MAX_MEMORY_FILES: usize = 200;

/// YAML frontmatter delimiter.
const FRONTMATTER_DELIM: &str = "---";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/// Read a single memory file, parsing its YAML frontmatter and body.
///
/// Gracefully degrades: if the file has no valid frontmatter, returns
/// a default (empty) frontmatter with the entire file as body content.
pub fn read_memory(path: &Path) -> Result<MemoryEntry> {
    let raw = fs::read_to_string(path)?;
    let (frontmatter, content) = parse_frontmatter(&raw, Some(path));
    Ok(MemoryEntry::new(frontmatter, content))
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/// Delete a memory file at the given path.
///
/// Returns an error if the file does not exist or cannot be removed.
pub fn delete_memory(path: &Path) -> Result<()> {
    fs::remove_file(path)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/// Scan a directory for memory files, returning lightweight headers.
///
/// - Recursively reads `.md` files, excluding `MEMORY.md`.
/// - Reads only the first 30 lines of each file for frontmatter extraction.
/// - Sorts by modification time (newest first).
/// - Caps results at 200 files.
///
/// Returns an empty list for non-existent or empty directories.
pub fn scan_memory_files(dir: &Path) -> Result<Vec<MemoryHeader>> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut headers = Vec::new();

    for entry in collect_md_files(dir)? {
        let path = entry;
        if let Some(header) = read_header(&path) {
            headers.push(header);
        }
    }

    // Sort by mtime descending (newest first).
    headers.sort_by_key(|h| std::cmp::Reverse(h.mtime));

    // Cap at limit.
    headers.truncate(MAX_MEMORY_FILES);

    Ok(headers)
}

// ---------------------------------------------------------------------------
// Manifest formatting
// ---------------------------------------------------------------------------

/// Format a list of memory headers as a human-readable manifest.
///
/// Each line: `- [type] filename (ISO8601): description`
/// Type tag omitted if absent; description omitted if absent.
pub fn format_memory_manifest(headers: &[MemoryHeader]) -> String {
    let mut lines = Vec::with_capacity(headers.len());

    for h in headers {
        let type_tag = h
            .memory_type
            .map(|t| format!("[{}] ", t))
            .unwrap_or_default();
        let ts = h.mtime.format("%Y-%m-%dT%H:%M:%S").to_string();
        let desc = h
            .description
            .as_deref()
            .map(|d| format!(": {d}"))
            .unwrap_or_default();

        lines.push(format!("- {type_tag}{} ({ts}){desc}", h.filename));
    }

    lines.join("\n")
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (internal)
// ---------------------------------------------------------------------------

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
fn parse_frontmatter(raw: &str, path: Option<&Path>) -> (MemoryFrontmatter, String) {
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

// ---------------------------------------------------------------------------
// Entry serialization (internal)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Filename generation (internal)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Directory traversal (internal)
// ---------------------------------------------------------------------------

/// Collect all `.md` files in a directory (recursive), excluding MEMORY.md.
fn collect_md_files(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    collect_md_files_recursive(dir, &mut files)?;
    Ok(files)
}

fn collect_md_files_recursive(dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            collect_md_files_recursive(&path, files)?;
        } else if is_scannable_md(&path) {
            files.push(path);
        }
    }

    Ok(())
}

/// Check if a path is a scannable `.md` file (not MEMORY.md).
fn is_scannable_md(path: &Path) -> bool {
    let ext = path.extension().and_then(|e| e.to_str());
    if ext != Some("md") {
        return false;
    }
    let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
    filename != ENTRYPOINT_NAME
}

// ---------------------------------------------------------------------------
// Header extraction (internal)
// ---------------------------------------------------------------------------

/// Read a file's first N lines and metadata to produce a header.
///
/// Returns `None` if the file cannot be read (silently drops failures).
fn read_header(path: &Path) -> Option<MemoryHeader> {
    let file = fs::File::open(path).ok()?;
    let reader = std::io::BufReader::new(file);

    let mut first_lines = String::new();
    for (i, line) in reader.lines().enumerate() {
        if i >= FRONTMATTER_MAX_LINES {
            break;
        }
        let line = line.ok()?;
        first_lines.push_str(&line);
        first_lines.push('\n');
    }

    let (fm, _) = parse_frontmatter(&first_lines, None);
    let mtime = file_mtime(path)?;
    let filename = path.file_name()?.to_string_lossy().into_owned();

    Some(MemoryHeader {
        filename,
        file_path: path.to_owned(),
        mtime,
        description: fm.description,
        memory_type: fm.memory_type,
    })
}

/// Get a file's modification time as UTC datetime.
fn file_mtime(path: &Path) -> Option<DateTime<Utc>> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let duration = modified.duration_since(std::time::UNIX_EPOCH).ok()?;
    Utc.timestamp_opt(duration.as_secs() as i64, duration.subsec_nanos())
        .single()
}

// ===========================================================================
// Unit tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::error::MemoryError;
    use crate::memory::types::MemoryType;

    // -- parse_frontmatter ---------------------------------------------------

    #[test]
    fn parse_full_frontmatter() {
        let raw = "---\nname: test\ndescription: a test\ntype: feedback\n---\nBody content";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm.name.as_deref(), Some("test"));
        assert_eq!(fm.description.as_deref(), Some("a test"));
        assert_eq!(fm.memory_type, Some(MemoryType::Feedback));
        assert_eq!(body, "Body content");
    }

    #[test]
    fn parse_no_frontmatter() {
        let raw = "Just plain text\nNo frontmatter here";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm, MemoryFrontmatter::default());
        assert_eq!(body, raw);
    }

    #[test]
    fn parse_empty_content() {
        let (fm, body) = parse_frontmatter("", None);
        assert_eq!(fm, MemoryFrontmatter::default());
        assert_eq!(body, "");
    }

    #[test]
    fn parse_only_opening_delimiter() {
        let raw = "---\nname: orphan\nno closing delimiter";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm, MemoryFrontmatter::default());
        assert_eq!(body, raw);
    }

    #[test]
    fn parse_partial_frontmatter_fields() {
        let raw = "---\nname: partial\n---\nBody";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm.name.as_deref(), Some("partial"));
        assert_eq!(fm.description, None);
        assert_eq!(fm.memory_type, None);
        assert_eq!(body, "Body");
    }

    #[test]
    fn parse_frontmatter_with_leading_whitespace() {
        let raw = "  \n---\nname: spaced\n---\nContent";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm.name.as_deref(), Some("spaced"));
        assert_eq!(body, "Content");
    }

    #[test]
    fn parse_invalid_yaml_degrades_gracefully() {
        // YAML with invalid structure — should return default frontmatter
        let raw = "---\n: :\n  :\n---\nBody after bad yaml";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm, MemoryFrontmatter::default());
        assert_eq!(body, "Body after bad yaml");
    }

    #[test]
    fn parse_frontmatter_body_newline_handling() {
        let raw = "---\nname: test\n---\n\nParagraph one\n\nParagraph two";
        let (fm, body) = parse_frontmatter(raw, None);
        assert_eq!(fm.name.as_deref(), Some("test"));
        // Body should start at first content line after delimiter
        assert_eq!(body, "Paragraph one\n\nParagraph two");
    }

    // -- serialize_entry -----------------------------------------------------

    #[test]
    fn serialize_and_parse_roundtrip() {
        let entry = MemoryEntry::build("role", "user role info", MemoryType::User, "I am a dev");
        let serialized = serialize_entry(&entry);
        let (fm, body) = parse_frontmatter(&serialized, None);
        assert_eq!(fm.name.as_deref(), Some("role"));
        assert_eq!(fm.description.as_deref(), Some("user role info"));
        assert_eq!(fm.memory_type, Some(MemoryType::User));
        assert_eq!(body, "I am a dev");
    }

    // -- generate_filename ---------------------------------------------------

    #[test]
    fn filename_with_type_and_name() {
        let fm = MemoryFrontmatter {
            name: Some("My Role".into()),
            description: None,
            memory_type: Some(MemoryType::User),
        };
        let name = generate_filename(&fm);
        assert_eq!(name, "user_my_role.md");
    }

    #[test]
    fn filename_without_type() {
        let fm = MemoryFrontmatter {
            name: Some("notes".into()),
            description: None,
            memory_type: None,
        };
        let name = generate_filename(&fm);
        assert_eq!(name, "memory_notes.md");
    }

    #[test]
    fn filename_without_name() {
        let fm = MemoryFrontmatter {
            name: None,
            description: None,
            memory_type: Some(MemoryType::Feedback),
        };
        let name = generate_filename(&fm);
        assert!(name.starts_with("feedback_"));
        assert!(name.ends_with(".md"));
    }

    #[test]
    fn filename_special_chars_sanitized() {
        let fm = MemoryFrontmatter {
            name: Some("Hello World! / Test: 123".into()),
            description: None,
            memory_type: Some(MemoryType::Project),
        };
        let name = generate_filename(&fm);
        assert_eq!(name, "project_hello_world_test_123.md");
        assert!(!name.contains(' '));
        assert!(!name.contains('/'));
        assert!(!name.contains('!'));
    }

    // -- sanitize_filename ---------------------------------------------------

    #[test]
    fn sanitize_basic() {
        assert_eq!(sanitize_filename("Hello World"), "hello_world");
    }

    #[test]
    fn sanitize_collapses_underscores() {
        assert_eq!(sanitize_filename("a---b___c"), "a_b_c");
    }

    #[test]
    fn sanitize_trims_underscores() {
        assert_eq!(sanitize_filename("__test__"), "test");
    }

    #[test]
    fn sanitize_preserves_alphanumeric() {
        assert_eq!(sanitize_filename("abc123"), "abc123");
    }

    #[test]
    fn sanitize_pure_non_ascii_returns_empty() {
        assert_eq!(sanitize_filename("我的角色"), "");
        assert_eq!(sanitize_filename("日本語"), "");
    }

    #[test]
    fn filename_pure_non_ascii_name_falls_back_to_hash() {
        let fm1 = MemoryFrontmatter {
            name: Some("我的角色".into()),
            description: None,
            memory_type: Some(MemoryType::User),
        };
        let fm2 = MemoryFrontmatter {
            name: Some("项目状态".into()),
            description: None,
            memory_type: Some(MemoryType::User),
        };
        let name1 = generate_filename(&fm1);
        let name2 = generate_filename(&fm2);
        // Both should get unique hash-based names, not collide
        assert!(name1.starts_with("user_"));
        assert!(name1.ends_with(".md"));
        assert_ne!(name1, "user_.md", "should not produce empty name part");
        // With time-based hash, names should differ (race possible but
        // extremely unlikely given nanos resolution)
        assert_ne!(name1, name2, "pure non-ASCII names should not collide");
    }

    // -- is_scannable_md -----------------------------------------------------

    #[test]
    fn scannable_normal_md() {
        assert!(is_scannable_md(Path::new("/dir/user_role.md")));
    }

    #[test]
    fn scannable_rejects_memory_md() {
        assert!(!is_scannable_md(Path::new("/dir/MEMORY.md")));
    }

    #[test]
    fn scannable_rejects_non_md() {
        assert!(!is_scannable_md(Path::new("/dir/notes.txt")));
        assert!(!is_scannable_md(Path::new("/dir/data.json")));
    }

    // -- format_memory_manifest ----------------------------------------------

    #[test]
    fn manifest_with_full_headers() {
        let headers = vec![MemoryHeader {
            filename: "user_role.md".into(),
            file_path: PathBuf::from("/mem/user_role.md"),
            mtime: Utc.with_ymd_and_hms(2026, 4, 10, 12, 0, 0).unwrap(),
            description: Some("User role info".into()),
            memory_type: Some(MemoryType::User),
        }];
        let manifest = format_memory_manifest(&headers);
        assert_eq!(
            manifest,
            "- [user] user_role.md (2026-04-10T12:00:00): User role info"
        );
    }

    #[test]
    fn manifest_without_type_and_description() {
        let headers = vec![MemoryHeader {
            filename: "notes.md".into(),
            file_path: PathBuf::from("/mem/notes.md"),
            mtime: Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap(),
            description: None,
            memory_type: None,
        }];
        let manifest = format_memory_manifest(&headers);
        assert_eq!(manifest, "- notes.md (2026-01-01T00:00:00)");
    }

    #[test]
    fn manifest_empty() {
        assert_eq!(format_memory_manifest(&[]), "");
    }

    // -- file operations (using tempdir) -------------------------------------

    #[test]
    fn write_then_read_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let entry = MemoryEntry::build("role", "my role", MemoryType::User, "I am a developer");

        let path = write_memory(tmp.path(), &entry).unwrap();
        assert!(path.exists());
        assert_eq!(path.file_name().unwrap().to_str().unwrap(), "user_role.md");

        let read_back = read_memory(&path).unwrap();
        assert_eq!(read_back.frontmatter.name, entry.frontmatter.name);
        assert_eq!(
            read_back.frontmatter.description,
            entry.frontmatter.description
        );
        assert_eq!(
            read_back.frontmatter.memory_type,
            entry.frontmatter.memory_type
        );
        assert_eq!(read_back.content, entry.content);
    }

    #[test]
    fn delete_existing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("test.md");
        fs::write(&path, "content").unwrap();
        assert!(path.exists());

        delete_memory(&path).unwrap();
        assert!(!path.exists());
    }

    #[test]
    fn delete_nonexistent_file_errors() {
        let err = delete_memory(Path::new("/nonexistent/file.md")).unwrap_err();
        assert!(matches!(err, MemoryError::Io(_)));
    }

    #[test]
    fn scan_excludes_memory_md_and_non_md() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path();

        // Create files
        fs::write(dir.join("user_role.md"), "---\ntype: user\n---\nBody").unwrap();
        fs::write(dir.join("MEMORY.md"), "# Index").unwrap();
        fs::write(dir.join("notes.txt"), "not markdown").unwrap();

        let headers = scan_memory_files(dir).unwrap();
        assert_eq!(headers.len(), 1);
        assert_eq!(headers[0].filename, "user_role.md");
    }

    #[test]
    fn scan_nonexistent_dir_returns_empty() {
        let headers = scan_memory_files(Path::new("/nonexistent/dir")).unwrap();
        assert!(headers.is_empty());
    }

    #[test]
    fn scan_empty_dir_returns_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let headers = scan_memory_files(tmp.path()).unwrap();
        assert!(headers.is_empty());
    }
}
