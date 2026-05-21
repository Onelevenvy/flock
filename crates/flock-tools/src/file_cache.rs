use std::num::NonZeroUsize;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use lru::LruCache;

use flock_core::config::file_cache::FileCacheConfig;
use flock_core::types::file_state::FileState;

/// LRU cache for file states seen by the model.
///
/// Provides dual eviction: entry-count limit (via LRU) and byte-size limit
/// (manually tracked). All path keys are normalized before access so that
/// `"/a/../b"` and `"/b"` map to the same cache slot.
///
/// Thread safety: wrap in `Arc<std::sync::RwLock<FileStateCache>>` when
/// sharing across tools. Cache operations are brief (hash lookup + insert),
/// so `std::sync::RwLock` is preferred over `tokio::sync::RwLock`.
pub struct FileStateCache {
    entries: LruCache<PathBuf, FileState>,
    max_size_bytes: usize,
    current_size_bytes: usize,
}

impl FileStateCache {
    /// Create a new cache from configuration.
    ///
    /// If `max_entries` is 0, defaults to 100.
    pub fn new(config: &FileCacheConfig) -> Self {
        let cap = NonZeroUsize::new(config.max_entries)
            .unwrap_or(NonZeroUsize::new(100).expect("100 is non-zero"));
        Self {
            entries: LruCache::new(cap),
            max_size_bytes: config.max_size_bytes,
            current_size_bytes: 0,
        }
    }

    /// Look up a file state, promoting it to most-recently-used.
    pub fn get(&mut self, path: &Path) -> Option<&FileState> {
        let normalized = normalize_path(path);
        self.entries.get(&normalized)
    }

    /// Insert or update a file state entry.
    ///
    /// Evicts least-recently-used entries when the byte-size limit or
    /// entry-count limit would be exceeded.
    pub fn insert(&mut self, path: PathBuf, state: FileState) {
        let normalized = normalize_path(&path);
        let new_size = state.content_bytes();

        // Remove existing entry for this key first (simplifies size accounting).
        if let Some(old) = self.entries.pop(&normalized) {
            self.current_size_bytes = self.current_size_bytes.saturating_sub(old.content_bytes());
        }

        // Evict LRU entries until byte-size budget is available.
        while self.current_size_bytes + new_size > self.max_size_bytes && !self.entries.is_empty() {
            if let Some((_k, v)) = self.entries.pop_lru() {
                self.current_size_bytes = self.current_size_bytes.saturating_sub(v.content_bytes());
            }
        }

        // push() returns evicted (key, value) if entry-count capacity is reached.
        if let Some((_evicted_key, evicted_val)) = self.entries.push(normalized, state) {
            self.current_size_bytes = self
                .current_size_bytes
                .saturating_sub(evicted_val.content_bytes());
        }
        self.current_size_bytes += new_size;
    }

    /// Remove a specific entry by path.
    pub fn remove(&mut self, path: &Path) -> Option<FileState> {
        let normalized = normalize_path(path);
        let removed = self.entries.pop(&normalized);
        if let Some(ref v) = removed {
            self.current_size_bytes = self.current_size_bytes.saturating_sub(v.content_bytes());
        }
        removed
    }

    /// Remove all entries.
    pub fn clear(&mut self) {
        self.entries.clear();
        self.current_size_bytes = 0;
    }

    /// Number of cached entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Current total byte size of all cached content.
    pub fn current_size_bytes(&self) -> usize {
        self.current_size_bytes
    }
}

/// Update the cache after a successful file write (Edit or Write).
///
/// Reads the new mtime from disk and stores line-numbered content.
/// This is the single point for post-write cache updates, eliminating
/// duplication between EditTool and WriteTool.
pub fn update_cache_after_write(
    cache_arc: &Arc<std::sync::RwLock<FileStateCache>>,
    path: &Path,
    content: &str,
) {
    let Ok(mut cache) = cache_arc.write() else {
        return;
    };
    let Some(new_mtime) = file_mtime_ms(path) else {
        return;
    };
    let numbered: Vec<String> = content
        .lines()
        .enumerate()
        .map(|(i, line)| format!("{:>6}\t{}", i + 1, line))
        .collect();
    cache.insert(
        path.to_path_buf(),
        FileState {
            content: numbered.join("\n"),
            mtime_ms: new_mtime,
            offset: None,
            limit: None,
        },
    );
}

/// Get file modification time as milliseconds since UNIX epoch.
///
/// Returns `None` if the file does not exist or metadata is unavailable.
pub fn file_mtime_ms(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let duration = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as u64)
}

/// Normalize a path by resolving `.` and `..` components without filesystem access.
///
/// Unlike `std::fs::canonicalize`, this does not require the path to exist on disk,
/// which is important because cache lookups can happen before the file is created.
///
/// Examples:
/// - `/a/../b/file` -> `/b/file`
/// - `a/./b/../c`   -> `a/c`
/// - `/../b`        -> `/b` (can't go above root)
fn normalize_path(path: &Path) -> PathBuf {
    let mut components: Vec<Component> = Vec::new();
    for component in path.components() {
        match component {
            Component::ParentDir => match components.last() {
                Some(Component::Normal(_)) => {
                    components.pop();
                }
                Some(Component::RootDir) => {
                    // Can't go above filesystem root; ignore the `..`
                }
                _ => {
                    // Preserve leading `..` in relative paths (e.g. `../../foo`)
                    components.push(component);
                }
            },
            Component::CurDir => {} // skip `.`
            other => components.push(other),
        }
    }
    let mut result = PathBuf::new();
    for c in &components {
        result.push(c);
    }
    result
}

