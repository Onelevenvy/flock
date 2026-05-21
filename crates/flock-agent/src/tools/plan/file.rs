// Plan file management: path generation, reading, and writing.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Build the plan file path for a given session.
///
/// Returns `{plan_dir}/{session_id}.md`.
pub fn plan_file_path(plan_dir: &Path, session_id: &str) -> PathBuf {
    plan_dir.join(format!("{session_id}.md"))
}

/// Write plan content to disk, creating parent directories if needed.
pub fn write_plan(path: &Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content)
}

/// Read plan content from disk.
///
/// Returns `None` if the file does not exist (instead of propagating an error).
/// Other I/O errors are still returned.
pub fn read_plan(path: &Path) -> io::Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}
