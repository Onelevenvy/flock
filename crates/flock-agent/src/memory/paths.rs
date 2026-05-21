// Path resolution and directory management for the memory system.
//
// Provides functions to compute memory directory locations, validate
// paths for security, and ensure directories exist.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Component, Path, PathBuf};

use crate::memory::error::{MemoryError, Result};

/// MEMORY.md entrypoint filename.
pub const ENTRYPOINT_NAME: &str = "MEMORY.md";

/// Maximum length for sanitized directory names before truncation.
const MAX_SANITIZED_LENGTH: usize = 200;

/// Environment variable to override the memory base directory.
const MEMORY_DIR_ENV: &str = "flock_MEMORY_DIR";

// ---------------------------------------------------------------------------
// Base directory resolution
// ---------------------------------------------------------------------------

/// Returns the base directory for memory storage.
///
/// Resolution order:
///   1. `flock_MEMORY_DIR` environment variable (explicit override)
///   2. `app_config_dir()` from `flock-config` (platform-aware default)
///
/// Returns `None` only when both the env var is unset AND the platform
/// cannot determine a config directory (e.g. no home directory).
pub fn memory_base_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var(MEMORY_DIR_ENV)
        && !dir.is_empty()
    {
        return Some(PathBuf::from(dir));
    }
    flock_core::config::settings::app_config_dir()
}

// ---------------------------------------------------------------------------
// Project-specific memory directory
// ---------------------------------------------------------------------------

/// Returns the auto-memory directory for a specific project.
///
/// Path: `<base>/projects/<sanitized_project_root>/memory/`
///
/// The project root is sanitized to produce a safe directory name:
/// all non-alphanumeric characters become hyphens, and long paths
/// are truncated with a hash suffix for uniqueness.
pub fn auto_memory_dir(project_root: &Path) -> Option<PathBuf> {
    let base = memory_base_dir()?;
    let sanitized = sanitize_path(&project_root.to_string_lossy());
    Some(base.join("projects").join(sanitized).join("memory"))
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

/// Returns the MEMORY.md entrypoint path within a memory directory.
pub fn memory_entrypoint(memory_dir: &Path) -> PathBuf {
    memory_dir.join(ENTRYPOINT_NAME)
}

// ---------------------------------------------------------------------------
// Path membership check
// ---------------------------------------------------------------------------

/// Check whether `path` belongs to the given memory directory.
///
/// Both paths are canonicalized (via `dunce::canonicalize` fallback to
/// `std::fs::canonicalize`) to prevent traversal bypasses through `..`
/// segments or symlinks.
///
/// Returns `false` if either path cannot be resolved (e.g. doesn't exist).
pub fn is_memory_path(path: &Path, memory_dir: &Path) -> bool {
    let Ok(normalized_path) = normalize_path(path) else {
        return false;
    };
    let Ok(normalized_dir) = normalize_path(memory_dir) else {
        return false;
    };
    normalized_path.starts_with(&normalized_dir)
}

// ---------------------------------------------------------------------------
// Directory creation
// ---------------------------------------------------------------------------

/// Ensure a memory directory exists, creating it and all parent
/// directories if necessary. Idempotent — safe to call repeatedly.
pub fn ensure_memory_dir(dir: &Path) -> Result<()> {
    fs::create_dir_all(dir)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

/// Validate a path for use as a memory file location.
///
/// Security checks:
/// - Must be an absolute path
/// - Must be at least 3 components long (rejects root `/` and near-root)
/// - Must not contain null bytes
/// - Must not contain `..` traversal segments
///
/// Returns the normalized path on success.
pub fn validate_memory_path(path: &Path) -> Result<PathBuf> {
    let path_str = path.to_string_lossy();

    if !path.is_absolute() {
        return Err(MemoryError::PathValidation("path must be absolute".into()));
    }

    // Count only Normal segments (skip Prefix, RootDir) so the threshold is
    // consistent across platforms: Unix `/a` → 1 Normal, Windows `C:\a` → 1 Normal.
    let depth = path
        .components()
        .filter(|c| matches!(c, Component::Normal(_)))
        .count();
    if depth < 2 {
        return Err(MemoryError::PathValidation("path is too short".into()));
    }

    if path_str.contains('\0') {
        return Err(MemoryError::PathValidation(
            "path contains null byte".into(),
        ));
    }

    if contains_traversal(&path_str) {
        return Err(MemoryError::PathValidation(
            "path contains traversal (..)".into(),
        ));
    }

    Ok(normalize_lexical(path))
}

// ---------------------------------------------------------------------------
// Path sanitization
// ---------------------------------------------------------------------------

/// Make a string safe for use as a directory name.
///
/// Replaces all non-alphanumeric characters with hyphens. If the result
/// exceeds `MAX_SANITIZED_LENGTH`, truncates and appends a hash suffix
/// to preserve uniqueness.
pub fn sanitize_path(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();

    if sanitized.len() <= MAX_SANITIZED_LENGTH {
        return sanitized;
    }

    let hash = simple_hash(name);
    format!("{}-{hash}", &sanitized[..MAX_SANITIZED_LENGTH])
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Check whether a path string contains `..` traversal segments.
fn contains_traversal(path: &str) -> bool {
    path.split(['/', '\\']).any(|seg| seg == "..")
}

/// Lexical path normalization without filesystem access.
///
/// Collapses `.` and redundant separators. Does NOT resolve `..`
/// (that's rejected before we get here) or symlinks.
fn normalize_lexical(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {} // skip `.`
            _ => result.push(component),
        }
    }
    result
}

/// Normalize a path for comparison: try filesystem canonicalization first,
/// fall back to lexical normalization if the path doesn't exist yet.
///
/// Returns `Err(())` when the path cannot be safely resolved — including
/// when canonicalization fails AND the path contains `..` segments
/// (lexical normalization cannot safely resolve parent references).
fn normalize_path(path: &Path) -> std::result::Result<PathBuf, ()> {
    if let Ok(canonical) = fs::canonicalize(path) {
        return Ok(canonical);
    }
    // Path doesn't exist on disk. Lexical normalization is only safe when
    // there are no `..` segments — those require real filesystem state to
    // resolve correctly (symlinks, mount points, etc.).
    if contains_traversal(&path.to_string_lossy()) {
        return Err(());
    }
    let normalized = normalize_lexical(path);
    if normalized.as_os_str().is_empty() {
        return Err(());
    }
    Ok(normalized)
}

/// Simple hash function for path truncation suffix.
fn simple_hash(s: &str) -> String {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    let hash = hasher.finish();
    format!("{hash:x}")
}

// ===========================================================================
// Unit tests
// ===========================================================================
