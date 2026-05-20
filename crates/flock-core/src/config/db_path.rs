use std::path::PathBuf;

/// Default install root name.
const DEFAULT_INSTALL_ROOT: &str = "flock-data";
/// Default workspaces directory name.
const DEFAULT_WORKSPACE_DIR: &str = "workspace";

/// Get the app installation/data root directory.
/// Priority: parent of `FLOCK_WORKSPACE_ROOT` if set, otherwise `<exe_dir>/flock-data`.
pub fn install_root() -> PathBuf {
    // 1. 优先使用环境变量（最高优先级）
    if let Ok(root_env) = std::env::var("FLOCK_WORKSPACE_ROOT") {
        let p = PathBuf::from(root_env.trim());
        let abs_p = if p.is_absolute() {
            p
        } else {
            std::env::current_dir().unwrap_or_default().join(p)
        };
        // 以环境变量的父级目录作为安装根目录
        return abs_p.parent().map(|parent| parent.to_path_buf()).unwrap_or(abs_p);
    }

    // 2. 获取可执行文件所在的目录（实现“安装目录”方案）
    let mut base_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|parent| parent.to_path_buf()))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    // 3. 特殊处理开发环境：如果是从 target 目录下运行的（如 cargo run 或 tauri dev），
    // 则尝试往上找，放到项目根目录，避免数据混入编译输出目录中。
    if base_dir.to_string_lossy().contains("target") {
        let mut temp = base_dir.clone();
        while let Some(parent) = temp.parent() {
            if temp.ends_with("target") {
                base_dir = parent.to_path_buf();
                break;
            }
            temp = parent.to_path_buf();
        }
    }

    base_dir.join(DEFAULT_INSTALL_ROOT)
}

/// Get the workspace root directory containing user workspaces.
/// Priority: `FLOCK_WORKSPACE_ROOT` env var > `<install_root>/workspace`.
pub fn workspace_root() -> PathBuf {
    // 1. 优先使用环境变量（最高优先级）
    if let Ok(root_env) = std::env::var("FLOCK_WORKSPACE_ROOT") {
        let p = PathBuf::from(root_env.trim());
        if p.is_absolute() {
            return p;
        }
        return std::env::current_dir().unwrap_or_default().join(p);
    }

    install_root().join(DEFAULT_WORKSPACE_DIR)
}

/// Resolve the SQLite database file path.
///
/// Priority (highest to lowest):
/// 1. Environment variable `FLOCK_DB_PATH`
/// 2. Bootstrap file `<install_root>/.flock_db_path.txt` (single line, trimmed)
/// 3. Default: `<install_root>/flock.db`
pub fn resolve_db_path() -> PathBuf {
    // 1. Env var
    if let Ok(path) = std::env::var("FLOCK_DB_PATH") {
        let p = PathBuf::from(path.trim());
        if !p.as_os_str().is_empty() {
            return p;
        }
    }

    // 2. Bootstrap file (in install root)
    let root = install_root();
    let bootstrap = root.join(".flock_db_path.txt");
    if let Ok(content) = std::fs::read_to_string(&bootstrap) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    // 3. Default: install root
    root.join("flock.db")
}

/// Write a custom DB path to the bootstrap file.
/// Takes effect on next restart.
pub fn set_db_path_override(path: &str) -> std::io::Result<()> {
    let root = install_root();
    std::fs::create_dir_all(&root)?;
    std::fs::write(root.join(".flock_db_path.txt"), path.trim())
}

/// Remove the bootstrap file override, reverting to default path on next restart.
pub fn clear_db_path_override() -> std::io::Result<()> {
    let bootstrap = install_root().join(".flock_db_path.txt");
    if bootstrap.exists() {
        std::fs::remove_file(bootstrap)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_returns_some_path() {
        // Should always return a non-empty path
        let path = resolve_db_path();
        assert!(!path.as_os_str().is_empty());
    }
}
