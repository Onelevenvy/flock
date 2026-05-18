/// Cached state of a file that the model has seen.
///
/// Stored in an LRU cache keyed by normalized file path.
/// Used by Read/Edit/Write tools for dedup detection and staleness checks.
#[derive(Debug, Clone)]
pub struct FileState {
    /// File content as seen by the model (with line numbers).
    pub content: String,
    /// File modification time when last read (milliseconds since UNIX epoch).
    pub mtime_ms: u64,
    /// Line offset of partial read (None = full read).
    pub offset: Option<usize>,
    /// Line limit of partial read (None = full read).
    pub limit: Option<usize>,
}

impl FileState {
    /// Byte size of the cached content (used for cache size accounting).
    pub fn content_bytes(&self) -> usize {
        self.content.len()
    }
}
