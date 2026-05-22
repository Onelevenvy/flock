// Memory file read, write, delete, scan, and manifest formatting.

pub mod read;
pub mod write;
pub mod delete;
pub mod scan;

pub use read::read_memory;
pub use write::write_memory;
pub use delete::delete_memory;
pub use scan::{scan_memory_files, format_memory_manifest};

/// Maximum number of lines to read when extracting frontmatter.
pub(crate) const FRONTMATTER_MAX_LINES: usize = 30;

/// Maximum number of files returned by a directory scan.
pub(crate) const MAX_MEMORY_FILES: usize = 200;

/// YAML frontmatter delimiter.
pub(crate) const FRONTMATTER_DELIM: &str = "---";
