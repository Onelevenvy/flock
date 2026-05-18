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

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use std::path::Path;

    // -- sanitize_path --------------------------------------------------------

    #[test]
    fn sanitize_simple_path() {
        assert_eq!(sanitize_path("/home/user/project"), "-home-user-project");
    }

    #[test]
    fn sanitize_preserves_alphanumeric() {
        assert_eq!(sanitize_path("abc123"), "abc123");
    }

    #[test]
    fn sanitize_replaces_special_chars() {
        assert_eq!(sanitize_path("a/b:c d"), "a-b-c-d");
    }

    #[test]
    fn sanitize_long_path_truncates_with_hash() {
        let long_path = "/".to_string() + &"a".repeat(300);
        let result = sanitize_path(&long_path);
        assert!(result.len() > MAX_SANITIZED_LENGTH); // truncated + hash
        assert!(result.len() < MAX_SANITIZED_LENGTH + 20); // hash isn't huge
        assert!(result.contains('-')); // has separator before hash
    }

    #[test]
    fn sanitize_two_long_paths_produce_different_results() {
        let path_a = "/".to_string() + &"a".repeat(300);
        let path_b = "/".to_string() + &"b".repeat(300);
        assert_ne!(sanitize_path(&path_a), sanitize_path(&path_b));
    }

    // -- contains_traversal ---------------------------------------------------

    #[test]
    fn traversal_detected() {
        assert!(contains_traversal("../foo"));
        assert!(contains_traversal("foo/../bar"));
        assert!(contains_traversal("/foo/.."));
        assert!(contains_traversal("foo\\..\\bar"));
    }

    #[test]
    fn traversal_not_detected_for_safe_paths() {
        assert!(!contains_traversal("/foo/bar"));
        assert!(!contains_traversal("foo.bar"));
        assert!(!contains_traversal("foo...bar"));
        assert!(!contains_traversal("/tmp/test.md"));
    }

    // -- validate_memory_path -------------------------------------------------

    #[test]
    fn validate_rejects_relative_path() {
        let err = validate_memory_path(Path::new("relative/path")).unwrap_err();
        assert!(matches!(err, MemoryError::PathValidation(_)));
        assert!(err.to_string().contains("absolute"));
    }

    #[cfg(unix)]
    #[test]
    fn validate_rejects_short_path() {
        let err = validate_memory_path(Path::new("/a")).unwrap_err();
        assert!(matches!(err, MemoryError::PathValidation(_)));
        assert!(err.to_string().contains("short"));
    }

    #[cfg(windows)]
    #[test]
    fn validate_rejects_short_path() {
        let err = validate_memory_path(Path::new("C:\\a")).unwrap_err();
        assert!(matches!(err, MemoryError::PathValidation(_)));
        assert!(err.to_string().contains("short"));
    }

    #[cfg(unix)]
    #[test]
    fn validate_rejects_traversal() {
        let err = validate_memory_path(Path::new("/tmp/../../../etc/passwd")).unwrap_err();
        assert!(matches!(err, MemoryError::PathValidation(_)));
        assert!(err.to_string().contains("traversal"));
    }

    #[cfg(windows)]
    #[test]
    fn validate_rejects_traversal() {
        let err = validate_memory_path(Path::new("C:\\tmp\\..\\..\\..\\etc\\passwd")).unwrap_err();
        assert!(matches!(err, MemoryError::PathValidation(_)));
        assert!(err.to_string().contains("traversal"));
    }

    #[cfg(unix)]
    #[test]
    fn validate_accepts_normal_absolute_path() {
        let result = validate_memory_path(Path::new("/tmp/memory/test.md"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PathBuf::from("/tmp/memory/test.md"));
    }

    #[cfg(windows)]
    #[test]
    fn validate_accepts_normal_absolute_path() {
        let result = validate_memory_path(Path::new("C:\\tmp\\memory\\test.md"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PathBuf::from("C:\\tmp\\memory\\test.md"));
    }

    // -- memory_entrypoint ----------------------------------------------------

    #[test]
    fn entrypoint_appends_memory_md() {
        let dir = Path::new("/base/memory");
        assert_eq!(
            memory_entrypoint(dir),
            PathBuf::from("/base/memory/MEMORY.md")
        );
    }

    // -- is_memory_path -------------------------------------------------------

    #[test]
    fn is_memory_path_inside() {
        // Use temp dir so paths actually exist for canonicalization
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        fs::create_dir_all(&mem_dir).unwrap();
        let file = mem_dir.join("test.md");
        fs::write(&file, "").unwrap();

        assert!(is_memory_path(&file, &mem_dir));
    }

    #[test]
    fn is_memory_path_outside() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        fs::create_dir_all(&mem_dir).unwrap();
        let outside = tmp.path().join("other.md");
        fs::write(&outside, "").unwrap();

        assert!(!is_memory_path(&outside, &mem_dir));
    }

    #[test]
    fn is_memory_path_nonexistent_returns_false() {
        // Non-existent paths with no common prefix
        assert!(!is_memory_path(
            Path::new("/nonexistent/a/b.md"),
            Path::new("/different/dir"),
        ));
    }

    #[test]
    fn is_memory_path_traversal_in_nonexistent_path_returns_false() {
        // Non-existent path with `..` must not bypass membership check
        // (regression test for review-1.3 ISSUE-1)
        assert!(!is_memory_path(
            Path::new("/base/memory/../../../etc/passwd"),
            Path::new("/base/memory"),
        ));
    }

    // -- ensure_memory_dir ----------------------------------------------------

    #[test]
    fn ensure_creates_nested_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let deep = tmp.path().join("a").join("b").join("c");
        assert!(!deep.exists());
        ensure_memory_dir(&deep).unwrap();
        assert!(deep.is_dir());
    }

    #[test]
    fn ensure_idempotent() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("memory");
        ensure_memory_dir(&dir).unwrap();
        // Second call should not error
        ensure_memory_dir(&dir).unwrap();
        assert!(dir.is_dir());
    }

    // -- memory_base_dir (env override) ---------------------------------------

    #[test]
    #[serial(env)]
    fn base_dir_env_override() {
        let key = MEMORY_DIR_ENV;
        let original = std::env::var(key).ok();

        // SAFETY: #[serial(env)] ensures no concurrent env mutation.
        unsafe { std::env::set_var(key, "/custom/memory") };
        let result = memory_base_dir();
        assert_eq!(result, Some(PathBuf::from("/custom/memory")));

        restore_env(key, original);
    }

    #[test]
    #[serial(env)]
    fn base_dir_empty_env_falls_through() {
        let key = MEMORY_DIR_ENV;
        let original = std::env::var(key).ok();

        // SAFETY: #[serial(env)] ensures no concurrent env mutation.
        unsafe { std::env::set_var(key, "") };
        let result = memory_base_dir();
        // Should fall through to app_config_dir
        assert_ne!(result, Some(PathBuf::from("")));

        restore_env(key, original);
    }

    // -- auto_memory_dir ------------------------------------------------------

    #[test]
    #[serial(env)]
    fn auto_memory_dir_structure() {
        let key = MEMORY_DIR_ENV;
        let original = std::env::var(key).ok();

        // SAFETY: #[serial(env)] ensures no concurrent env mutation.
        unsafe { std::env::set_var(key, "/base") };
        let dir = auto_memory_dir(Path::new("/home/user/project")).unwrap();
        assert_eq!(
            dir,
            PathBuf::from("/base/projects/-home-user-project/memory")
        );

        restore_env(key, original);
    }

    fn restore_env(key: &str, saved: Option<String>) {
        // SAFETY: only called from #[serial(env)] tests.
        unsafe {
            match saved {
                Some(v) => std::env::set_var(key, v),
                None => std::env::remove_var(key),
            }
        }
    }

    // -- normalize_lexical ----------------------------------------------------

    #[test]
    fn normalize_collapses_dot() {
        let input = Path::new("/foo/./bar/./baz");
        assert_eq!(normalize_lexical(input), PathBuf::from("/foo/bar/baz"));
    }

    #[test]
    fn normalize_preserves_absolute() {
        let input = Path::new("/foo/bar");
        assert_eq!(normalize_lexical(input), PathBuf::from("/foo/bar"));
    }
}
