use std::fs;
use std::path::Path;
use crate::memory::error::Result;

/// Delete a memory file at the given path.
///
/// Returns an error if the file does not exist or cannot be removed.
pub fn delete_memory(path: &Path) -> Result<()> {
    fs::remove_file(path)?;
    Ok(())
}
