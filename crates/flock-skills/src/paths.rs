use std::path::{Path, PathBuf};

use flock_core::config::settings::app_config_dir;

// ---------------------------------------------------------------------------
// User-level directories (<config_dir>/flock/)
// ---------------------------------------------------------------------------

/// Return the user-level skills directory: `<config_dir>/flock/skills/`
///
/// Returns `None` if the platform config directory cannot be determined.
pub fn user_skills_dir() -> Option<PathBuf> {
    app_config_dir().map(|d| d.join("skills"))
}

/// Return the user-level legacy commands directory: `<config_dir>/flock/commands/`
pub fn user_commands_dir() -> Option<PathBuf> {
    app_config_dir().map(|d| d.join("commands"))
}

// ---------------------------------------------------------------------------
// Workspace-level directory (skills next to workspace)
// ---------------------------------------------------------------------------

/// Return the workspace-level skills directory: `<install_root>/skills/`
///
/// Uses the same `install_root()` logic as the database path resolution:
/// - Respects `FLOCK_WORKSPACE_ROOT` env var
/// - Auto-detects exe directory (with target/ special case for dev)
/// - Falls back to `skills` inside the `flock-data` directory
pub fn workspace_skills_dir() -> PathBuf {
    // 1. 优先检查默认安装目录（比如开发环境下的 <exe_dir>/flock-data/skills，或通过环境变量指定的路径）
    let default_path = flock_core::config::db_path::install_root().join("skills");
    if default_path.is_dir() {
        return default_path;
    }

    // 2. 检查 Tauri 打包后的各种可能资源目录
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // A. Windows/Linux: 带有 _up_ 的相对打包路径（使用简单字符串配置资源时的旧布局）
            // 例如：<exe_dir>/_up_/_up_/flock-data/skills
            let win_linux_up = exe_dir.join("_up_").join("_up_").join("flock-data").join("skills");
            if win_linux_up.is_dir() {
                return win_linux_up;
            }

            // B. Windows/Linux: <exe_dir>/resources/_up_/_up_/flock-data/skills
            let win_linux_resource_up = exe_dir.join("resources").join("_up_").join("_up_").join("flock-data").join("skills");
            if win_linux_resource_up.is_dir() {
                return win_linux_resource_up;
            }

            // C. Windows/Linux: <exe_dir>/resources/skills （使用 target 映射时的新布局）
            let win_linux_resource = exe_dir.join("resources").join("skills");
            if win_linux_resource.is_dir() {
                return win_linux_resource;
            }

            // D. macOS: <exe_dir>/../Resources/_up_/_up_/flock-data/skills
            let macos_resource_up = exe_dir.join("..").join("Resources").join("_up_").join("_up_").join("flock-data").join("skills");
            if macos_resource_up.is_dir() {
                return macos_resource_up;
            }

            // E. macOS: <exe_dir>/../Resources/skills
            let macos_resource = exe_dir.join("..").join("Resources").join("skills");
            if macos_resource.is_dir() {
                return macos_resource;
            }

            // F. 备用：直接在可执行文件同级目录寻找 skills
            let direct_skills = exe_dir.join("skills");
            if direct_skills.is_dir() {
                return direct_skills;
            }
        }
    }

    // 如果以上路径都不存在，回退到默认路径
    default_path
}

// ---------------------------------------------------------------------------
// Project-level directories (walk up from cwd)
// ---------------------------------------------------------------------------

/// Find all project-level `.flock/skills/` directories by walking up from
/// `cwd` to the nearest git root (or home directory), returning deepest-first.
///
/// Deepest-first means the most-specific project directory wins in the
/// priority ordering (closer to cwd = higher priority).
pub fn project_skills_dirs(cwd: &Path) -> Vec<PathBuf> {
    walk_up_dirs(cwd, "skills")
}

/// Find all project-level `.flock/commands/` directories (legacy), same walk.
pub fn project_commands_dirs(cwd: &Path) -> Vec<PathBuf> {
    walk_up_dirs(cwd, "commands")
}

/// Resolve additional skill directories from `--add-dir` paths.
///
/// Each path in `add_dirs` is checked for a `.flock/skills/` subdirectory.
/// Only directories that exist are included.
pub fn additional_skills_dirs(add_dirs: &[PathBuf]) -> Vec<PathBuf> {
    add_dirs
        .iter()
        .map(|d| d.join(".flock").join("skills"))
        .filter(|p| p.is_dir())
        .collect()
}

// ---------------------------------------------------------------------------
// Git root detection
// ---------------------------------------------------------------------------

/// Find the nearest git root from `start` by walking up looking for a `.git`
/// entry (file or directory). Returns `None` if no `.git` is found before
/// reaching the filesystem root.
pub fn find_git_root(start: &Path) -> Option<PathBuf> {
    let mut current = start.to_path_buf();
    loop {
        if current.join(".git").exists() {
            return Some(current);
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => return None,
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Walk up from `cwd` to the git root (or home directory), collecting all
/// `.flock/<subdir>/` directories that exist. Returns deepest-first.
fn walk_up_dirs(cwd: &Path, subdir: &str) -> Vec<PathBuf> {
    let stop_at = traversal_root(cwd);
    let mut dirs = Vec::new();
    let mut current = cwd.to_path_buf();

    loop {
        let candidate = current.join(".flock").join(subdir);
        if candidate.is_dir() {
            dirs.push(candidate);
        }

        // Stop if we've reached the boundary or the filesystem root
        if Some(&current) == stop_at.as_ref() || current.parent().is_none() {
            break;
        }

        match current.parent() {
            Some(parent) if parent != current.as_path() => {
                current = parent.to_path_buf();
            }
            _ => break,
        }
    }

    dirs
}

/// Determine where to stop walking up. Stops at git root if found,
/// otherwise at the user home directory.
pub fn traversal_root(cwd: &Path) -> Option<PathBuf> {
    find_git_root(cwd).or_else(dirs::home_dir)
}

