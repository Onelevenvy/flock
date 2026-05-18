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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // --- @include expansion tests ---

    #[test]
    fn test_no_includes_passthrough() {
        let tmp = TempDir::new().unwrap();
        let mut seen = HashSet::new();
        let input = "Hello world\nNo includes here.";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert_eq!(result, input);
    }

    #[test]
    fn test_simple_include() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("other.md"), "INCLUDED_CONTENT").unwrap();
        let mut seen = HashSet::new();
        let input = "@other.md";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(result.contains("INCLUDED_CONTENT"));
        assert!(!result.contains("@other.md"));
    }

    #[test]
    fn test_include_relative_dot() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("sub.md"), "SUB_CONTENT").unwrap();
        let mut seen = HashSet::new();
        let input = "@./sub.md";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(result.contains("SUB_CONTENT"));
    }

    #[test]
    fn test_include_inside_code_block_ignored() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("skip.md"), "SHOULD_NOT_APPEAR").unwrap();
        let mut seen = HashSet::new();
        let input = "```\n@skip.md\n```";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(!result.contains("SHOULD_NOT_APPEAR"));
        assert!(result.contains("@skip.md"));
    }

    #[test]
    fn test_include_missing_file_silently_skipped() {
        let tmp = TempDir::new().unwrap();
        let mut seen = HashSet::new();
        let input = "before\n@nonexistent.md\nafter";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(result.contains("before"));
        assert!(result.contains("after"));
        assert!(!result.contains("@nonexistent.md"));
    }

    #[test]
    fn test_include_circular_reference() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("a.md"), "A_CONTENT\n@b.md").unwrap();
        fs::write(tmp.path().join("b.md"), "B_CONTENT\n@a.md").unwrap();
        let mut seen = HashSet::new();
        let result = expand_includes("@a.md", tmp.path(), 0, &mut seen);
        assert!(result.contains("A_CONTENT"));
        assert!(result.contains("B_CONTENT"));
        // @a.md in b.md should be skipped (circular)
    }

    #[test]
    fn test_include_max_depth() {
        let tmp = TempDir::new().unwrap();
        // Chain: d0 → d1 → d2 → d3 → d4 → d5 → d6
        // With MAX_INCLUDE_DEPTH=5, expansion from the outer call:
        // outer(0) expands @d0 at depth 0 → d0 content expanded at depth 1
        // depth 1 expands @d1 → d1 at depth 2 → ... → d3 at depth 4
        // depth 4 expands @d4 → d4 at depth 5 → depth 5 >= MAX, @d5 NOT expanded
        for i in 0..7 {
            let content = if i < 6 {
                format!("DEPTH_{i}\n@d{}.md", i + 1)
            } else {
                format!("DEPTH_{i}")
            };
            fs::write(tmp.path().join(format!("d{i}.md")), content).unwrap();
        }
        let mut seen = HashSet::new();
        let result = expand_includes("@d0.md", tmp.path(), 0, &mut seen);
        assert!(result.contains("DEPTH_0"));
        assert!(result.contains("DEPTH_3"));
        assert!(result.contains("DEPTH_4"));
        // DEPTH_5 should NOT appear — depth limit reached
        assert!(!result.contains("DEPTH_5"));
    }

    #[test]
    fn test_include_disallowed_extension() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("image.png"), "BINARY_DATA").unwrap();
        let mut seen = HashSet::new();
        let input = "@image.png";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(!result.contains("BINARY_DATA"));
    }

    #[test]
    fn test_include_with_surrounding_text() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("inc.md"), "MIDDLE").unwrap();
        let mut seen = HashSet::new();
        let input = "TOP\n@inc.md\nBOTTOM";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert_eq!(result, "TOP\nMIDDLE\nBOTTOM");
    }

    #[test]
    fn test_is_allowed_extension() {
        assert!(is_allowed_extension(Path::new("file.md")));
        assert!(is_allowed_extension(Path::new("file.txt")));
        assert!(is_allowed_extension(Path::new("file.yaml")));
        assert!(is_allowed_extension(Path::new("file.yml")));
        assert!(is_allowed_extension(Path::new("file.toml")));
        assert!(is_allowed_extension(Path::new("file.json")));
        assert!(!is_allowed_extension(Path::new("file.png")));
        assert!(!is_allowed_extension(Path::new("file.rs")));
        assert!(!is_allowed_extension(Path::new("file")));
    }

    #[test]
    fn test_inline_code_span_not_expanded() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("x.md"), "SHOULD_NOT_APPEAR").unwrap();
        let mut seen = HashSet::new();
        let input = "Use `@x.md` for config";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(!result.contains("SHOULD_NOT_APPEAR"));
    }

    #[test]
    fn test_home_path_expansion() {
        let tmp = TempDir::new().unwrap();
        let mut seen = HashSet::new();
        let input = "@~/nonexistent-test-file.md";
        let result = expand_includes(input, tmp.path(), 0, &mut seen);
        assert!(!result.contains("@~/"));
    }

    // --- Discovery tests ---

    #[test]
    fn test_collect_no_agents_md_anywhere() {
        let tmp = TempDir::new().unwrap();
        let cwd = tmp.path();
        fs::create_dir(cwd.join(".git")).unwrap();
        let files = collect_agents_md(&cwd.to_string_lossy());
        assert!(files.is_empty());
    }

    #[test]
    fn test_collect_cwd_only() {
        let tmp = TempDir::new().unwrap();
        let cwd = tmp.path();
        fs::create_dir(cwd.join(".git")).unwrap();
        fs::write(cwd.join("AGENTS.md"), "CWD_RULES").unwrap();

        let files = collect_agents_md(&cwd.to_string_lossy());
        assert_eq!(files.len(), 1);
        assert!(files[0].content.contains("CWD_RULES"));
        assert!(!files[0].is_global);
    }

    #[test]
    fn test_collect_hierarchical_ordering() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        fs::create_dir(root.join(".git")).unwrap();
        fs::write(root.join("AGENTS.md"), "ROOT_RULES").unwrap();

        let sub = root.join("packages").join("server");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("AGENTS.md"), "SUB_RULES").unwrap();

        let files = collect_agents_md(&sub.to_string_lossy());
        assert_eq!(files.len(), 2);
        assert!(files[0].content.contains("ROOT_RULES"));
        assert!(files[1].content.contains("SUB_RULES"));
    }

    #[test]
    fn test_collect_stops_at_git_root() {
        let tmp = TempDir::new().unwrap();
        let above_git = tmp.path();
        fs::write(above_git.join("AGENTS.md"), "ABOVE_GIT_SHOULD_NOT_APPEAR").unwrap();

        let repo = above_git.join("repo");
        fs::create_dir_all(&repo).unwrap();
        fs::create_dir(repo.join(".git")).unwrap();
        fs::write(repo.join("AGENTS.md"), "REPO_RULES").unwrap();

        let files = collect_agents_md(&repo.to_string_lossy());
        assert_eq!(files.len(), 1);
        assert!(files[0].content.contains("REPO_RULES"));
    }

    #[test]
    fn test_collect_skips_empty_agents_md() {
        let tmp = TempDir::new().unwrap();
        let cwd = tmp.path();
        fs::create_dir(cwd.join(".git")).unwrap();
        fs::write(cwd.join("AGENTS.md"), "   \n  ").unwrap();

        let files = collect_agents_md(&cwd.to_string_lossy());
        assert!(files.is_empty());
    }

    #[test]
    fn test_collect_with_include_expanded() {
        let tmp = TempDir::new().unwrap();
        let cwd = tmp.path();
        fs::create_dir(cwd.join(".git")).unwrap();
        fs::write(cwd.join("AGENTS.md"), "@rules.md").unwrap();
        fs::write(cwd.join("rules.md"), "INCLUDED_RULES").unwrap();

        let files = collect_agents_md(&cwd.to_string_lossy());
        assert_eq!(files.len(), 1);
        assert!(files[0].content.contains("INCLUDED_RULES"));
    }

    // --- Formatting tests ---

    #[test]
    fn test_format_empty() {
        let files: Vec<AgentsMdFile> = vec![];
        let result = format_agents_md_section(&files);
        assert!(result.is_empty());
    }

    #[test]
    fn test_format_single_project() {
        let files = vec![AgentsMdFile {
            path: PathBuf::from("/workspace/AGENTS.md"),
            content: "My rules".to_string(),
            is_global: false,
        }];
        let result = format_agents_md_section(&files);
        assert!(result.contains("Be sure to adhere to these instructions"));
        assert!(result.contains("Contents of /workspace/AGENTS.md (project instructions):"));
        assert!(result.contains("My rules"));
    }

    #[test]
    fn test_format_global_and_project() {
        let files = vec![
            AgentsMdFile {
                path: PathBuf::from("/home/user/.config/flock/AGENTS.md"),
                content: "Global rules".to_string(),
                is_global: true,
            },
            AgentsMdFile {
                path: PathBuf::from("/workspace/AGENTS.md"),
                content: "Project rules".to_string(),
                is_global: false,
            },
        ];
        let result = format_agents_md_section(&files);
        let global_pos = result.find("Global rules").unwrap();
        let project_pos = result.find("Project rules").unwrap();
        assert!(global_pos < project_pos, "global before project");
        assert!(result.contains("(user's global instructions for all projects)"));
        assert!(result.contains("(project instructions)"));
    }
}
