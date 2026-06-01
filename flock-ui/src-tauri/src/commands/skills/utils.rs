use std::path::{Path, PathBuf};

/// Helper to get the custom imported skills directory
pub fn imported_skills_dir() -> Option<PathBuf> {
    Some(flock_core::config::db_path::install_root().join("imported_skills"))
}

/// Check if a directory contains SKILL.md files (directly or in immediate subdirectories).
pub fn has_skill_md(dir: &Path) -> bool {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name == "SKILL.md" {
                return true;
            }
            if entry.path().is_dir() {
                if entry.path().join("SKILL.md").exists() {
                    return true;
                }
            }
        }
    }
    false
}

/// Helper to recursively copy directories
pub fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    std::fs::create_dir_all(&dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}
