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
