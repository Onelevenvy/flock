use std::collections::HashSet;
use std::path::{Path, PathBuf};

use flock_core::config::settings::app_config_dir;
use flock_skills::paths::traversal_root;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

pub struct AgentsMdFile {
    pub path: PathBuf,
    pub content: String,
    pub is_global: bool,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_INCLUDE_DEPTH: u8 = 5;

const ALLOWED_EXTENSIONS: &[&str] = &[".md", ".txt", ".json", ".yaml", ".yml", ".toml"];

const INSTRUCTION_PREAMBLE: &str = "Codebase and user instructions are shown below. \
Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any \
default behavior and you MUST follow them exactly as written.";

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

pub fn collect_agents_md(cwd: &str) -> Vec<AgentsMdFile> {
    let cwd_path = Path::new(cwd);
    let mut files = Vec::new();

    // 1. Global: <config_dir>/flock/AGENTS.md
    if let Some(global_path) = app_config_dir().map(|d| d.join("AGENTS.md"))
        && let Some(file) = read_agents_md(&global_path, true)
    {
        files.push(file);
    }

    // 2. Walk up from cwd to stop_boundary, collect AGENTS.md paths
    let boundary = traversal_root(cwd_path);
    let mut project_paths = Vec::new();
    let mut current = cwd_path.to_path_buf();

    loop {
        let candidate = current.join("AGENTS.md");
        if candidate.is_file() {
            project_paths.push(candidate);
        }

        if Some(&current) == boundary.as_ref() || current.parent().is_none() {
            break;
        }

        match current.parent() {
            Some(parent) if parent != current.as_path() => {
                current = parent.to_path_buf();
            }
            _ => break,
        }
    }

    // Reverse: collected deepest-first, we want root-first
    project_paths.reverse();

    for path in project_paths {
        if let Some(file) = read_agents_md(&path, false) {
            files.push(file);
        }
    }

    files
}

fn read_agents_md(path: &Path, is_global: bool) -> Option<AgentsMdFile> {
    let raw = std::fs::read_to_string(path).ok()?;
    if raw.trim().is_empty() {
        return None;
    }
    let base_dir = path.parent()?;
    let mut seen = HashSet::new();
    if let Ok(canonical) = path.canonicalize() {
        seen.insert(canonical);
    }
    let content = expand_includes(&raw, base_dir, 0, &mut seen);
    Some(AgentsMdFile {
        path: path.to_path_buf(),
        content,
        is_global,
    })
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

pub fn format_agents_md_section(files: &[AgentsMdFile]) -> String {
    if files.is_empty() {
        return String::new();
    }

    let mut parts = vec![INSTRUCTION_PREAMBLE.to_string()];

    for file in files {
        let description = if file.is_global {
            "(user's global instructions for all projects)"
        } else {
            "(project instructions)"
        };
        let header = format!("Contents of {} {}:", file.path.display(), description);
        parts.push(format!("{header}\n\n{}", file.content.trim()));
    }

    parts.join("\n\n")
}

// ---------------------------------------------------------------------------
// @include expansion
// ---------------------------------------------------------------------------

fn is_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let dotted = format!(".{e}");
            ALLOWED_EXTENSIONS.contains(&dotted.as_str())
        })
        .unwrap_or(false)
}

fn resolve_include_path(raw: &str, base_dir: &Path) -> Option<PathBuf> {
    let path_str = raw.trim();
    if path_str.is_empty() {
        return None;
    }

    let resolved = if let Some(rest) = path_str.strip_prefix("~/") {
        dirs::home_dir()?.join(rest)
    } else if let Some(rest) = path_str.strip_prefix("./") {
        base_dir.join(rest)
    } else if path_str.starts_with('/') {
        PathBuf::from(path_str)
    } else {
        base_dir.join(path_str)
    };

    Some(resolved)
}

fn expand_includes(
    content: &str,
    base_dir: &Path,
    depth: u8,
    seen: &mut HashSet<PathBuf>,
) -> String {
    let mut result = Vec::new();
    let mut in_code_block = false;

    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            result.push(line.to_string());
            continue;
        }

        if in_code_block {
            result.push(line.to_string());
            continue;
        }

        let standalone = line.trim();
        if standalone.starts_with('@') && !standalone.contains('`') {
            let path_str = &standalone[1..];
            // Strip fragment identifiers
            let path_str = match path_str.find('#') {
                Some(i) => &path_str[..i],
                None => path_str,
            };

            if let Some(resolved) = resolve_include_path(path_str, base_dir) {
                if !is_allowed_extension(&resolved) {
                    continue;
                }
                let canonical = resolved.canonicalize().unwrap_or_else(|_| resolved.clone());
                if seen.contains(&canonical) || depth >= MAX_INCLUDE_DEPTH {
                    continue;
                }
                if let Ok(included) = std::fs::read_to_string(&resolved) {
                    seen.insert(canonical);
                    let expanded = expand_includes(
                        &included,
                        resolved.parent().unwrap_or(base_dir),
                        depth + 1,
                        seen,
                    );
                    result.push(expanded);
                }
                continue;
            }
        }

        result.push(line.to_string());
    }

    result.join("\n")
}

