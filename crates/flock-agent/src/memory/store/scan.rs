use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use chrono::{DateTime, TimeZone, Utc};
use crate::memory::error::Result;
use crate::memory::paths::ENTRYPOINT_NAME;
use crate::memory::types::MemoryHeader;
use super::read::parse_frontmatter;
use super::{FRONTMATTER_MAX_LINES, MAX_MEMORY_FILES};

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
