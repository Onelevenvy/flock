use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use futures::future::join_all;

use crate::bundled;
use crate::frontmatter::{parse_frontmatter, parse_skill_fields};
use crate::mcp::load_mcp_skills;
use crate::paths::{
    additional_skills_dirs, project_commands_dirs, project_skills_dirs, user_commands_dir,
    user_skills_dir, workspace_skills_dir,
};
use crate::types::{LoadChannel, SkillMetadata, SkillSource};
use flock_tools::mcp::manager::McpManager;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// A loaded skill paired with its canonical filesystem path for deduplication.
pub struct LoadedSkill {
    pub metadata: SkillMetadata,
    /// Canonicalized path used for dedup (symlinks resolved, `.`/`..` removed).
    pub resolved_path: PathBuf,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Load all skills from the filesystem and optionally from MCP servers.
///
/// Priority order (highest first): bundled → MCP → user → workspace → project → additional → extra_raw → legacy.
/// Deduplicates first by canonical path (symlinks resolved), then by name (first wins).
/// Bundled skills always take precedence over same-named MCP or filesystem skills.
///
/// If `bare` is true, only `add_dirs` are consulted (used for isolated
/// environments where the user/project directories should be ignored).
/// Bundled skills are included in bare mode as well.
///
/// Pass `mcp_manager: Some(&manager)` to include MCP-discovered skills.
///
/// `extra_raw_dirs` are directories loaded directly (no `.flock/skills` suffix).
/// Each directory is scanned for `SKILL.md` files or subdirectories containing them.
pub async fn load_all_skills(
    cwd: &Path,
    add_dirs: &[PathBuf],
    bare: bool,
    mcp_manager: Option<&McpManager>,
    extra_raw_dirs: &[PathBuf],
) -> Vec<SkillMetadata> {
    // Resolve bundled skills with file extraction (async context).
    let bundled_loaded = prepare_bundled_loaded().await;

    let mut all: Vec<LoadedSkill> = Vec::new();

    if bare {
        // Bare mode: only load from explicit add_dirs and extra_raw_dirs
        let dirs = additional_skills_dirs(add_dirs);
        let futures: Vec<_> = dirs
            .iter()
            .map(|d| load_skills_from_dir(d, SkillSource::Project, LoadChannel::Skills))
            .collect();
        for batch in join_all(futures).await {
            all.extend(batch);
        }
        let futures: Vec<_> = extra_raw_dirs
            .iter()
            .filter(|d| d.is_dir())
            .map(|d| load_skills_from_dir(d, SkillSource::User, LoadChannel::Skills))
            .collect();
        for batch in join_all(futures).await {
            all.extend(batch);
        }
        // Bundled skills prepended so they win deduplication
        all.splice(0..0, bundled_loaded);
        return deduplicate_by_name(deduplicate(all));
    }

    // 1. User-level skills (highest priority)
    if let Some(dir) = user_skills_dir()
        && dir.is_dir()
    {
        all.extend(load_skills_from_dir(&dir, SkillSource::User, LoadChannel::Skills).await);
    }

    // 2. Workspace-level skills (skills next to workspace)
    let ws_dir = workspace_skills_dir();
    if ws_dir.is_dir() {
        all.extend(load_skills_from_dir(&ws_dir, SkillSource::Bundled, LoadChannel::Skills).await);
    }

    // 3. Project-level skills (parallel across all dirs)
    let project_dirs = project_skills_dirs(cwd);
    let futures: Vec<_> = project_dirs
        .iter()
        .map(|d| load_skills_from_dir(d, SkillSource::Project, LoadChannel::Skills))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    // 4. Additional dirs from --add-dir
    let add_skill_dirs = additional_skills_dirs(add_dirs);
    let futures: Vec<_> = add_skill_dirs
        .iter()
        .map(|d| load_skills_from_dir(d, SkillSource::Project, LoadChannel::Skills))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    // 5. Extra raw dirs (direct folder import, no .flock/skills suffix)
    let futures: Vec<_> = extra_raw_dirs
        .iter()
        .filter(|d| d.is_dir())
        .map(|d| load_skills_from_dir(d, SkillSource::User, LoadChannel::Skills))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    // 6. User-level legacy commands (lowest user priority)
    if let Some(dir) = user_commands_dir()
        && dir.is_dir()
    {
        all.extend(load_skills_from_commands_dir(&dir, SkillSource::User).await);
    }

    // 7. Project-level legacy commands (parallel)
    let cmd_dirs = project_commands_dirs(cwd);
    let futures: Vec<_> = cmd_dirs
        .iter()
        .map(|d| load_skills_from_commands_dir(d, SkillSource::Project))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    // MCP skills inserted after bundled (highest priority) but before filesystem
    // skills, so: bundled > MCP > user > workspace > project > additional > extra_raw > legacy.
    let mcp_loaded = match mcp_manager {
        Some(mgr) => load_mcp_skills(mgr).await,
        None => Vec::new(),
    };

    // Bundled skills first, then MCP, then filesystem
    all.splice(0..0, mcp_loaded);
    all.splice(0..0, bundled_loaded);

    // Path-based dedup first (handles symlinked duplicates), then name-based
    // dedup to enforce MCP vs. filesystem priority.
    deduplicate_by_name(deduplicate(all))
}

/// Call `bundled::prepare_bundled_skills()` and wrap results as `LoadedSkill`.
///
/// Each bundled skill is assigned a virtual path `<bundled:name>` for
/// deduplication purposes (these paths can never match real filesystem paths).
async fn prepare_bundled_loaded() -> Vec<LoadedSkill> {
    bundled::extract_bundled_skills()
        .await
        .into_iter()
        .map(|meta| {
            let virtual_path = PathBuf::from(format!("<bundled:{}>", meta.name));
            LoadedSkill {
                metadata: meta,
                resolved_path: virtual_path,
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Internal: load from skills/ directory (directory-only format)
// ---------------------------------------------------------------------------

/// Load skills from a `skills/` directory.
///
/// Only the directory format is supported: each direct or nested subdirectory
/// that contains a `SKILL.md` file (case-sensitive) is loaded.
/// The skill name is derived from the relative path using colon separators.
pub(crate) async fn load_skills_from_dir(
    base_dir: &Path,
    source: SkillSource,
    loaded_from: LoadChannel,
) -> Vec<LoadedSkill> {
    let mut results = Vec::new();
    collect_skill_md(base_dir, base_dir, source, loaded_from, &mut results).await;
    results
}

/// Recursively scan `dir` for `SKILL.md` files.
// This is a recursive async function — we use a Box::pin to satisfy the compiler.
fn collect_skill_md<'a>(
    base_dir: &'a Path,
    dir: &'a Path,
    source: SkillSource,
    loaded_from: LoadChannel,
    results: &'a mut Vec<LoadedSkill>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        let mut read_dir = match tokio::fs::read_dir(dir).await {
            Ok(rd) => rd,
            Err(_) => return,
        };

        while let Ok(Some(entry)) = read_dir.next_entry().await {
            let path = entry.path();
            // Follow symlinks: entry.file_type() does NOT traverse symlinks,
            // so use tokio::fs::metadata() which resolves the target type.
            let is_dir = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.is_dir(),
                Err(_) => continue,
            };

            if is_dir {
                // Check for SKILL.md directly inside this subdirectory using an
                // exact case-sensitive name comparison (important on case-insensitive
                // filesystems like macOS APFS).
                if let Some(skill_file) = find_exact_file(&path, "SKILL.md").await {
                    if let Some(skill) =
                        load_skill_file(&skill_file, base_dir, &path, source, loaded_from).await
                    {
                        results.push(skill);
                    }
                } else {
                    // Recurse into subdirectory (namespace nesting)
                    collect_skill_md(base_dir, &path, source, loaded_from, results).await;
                }
            }
        }
    })
}

// ---------------------------------------------------------------------------
// Internal: load from commands/ directory (legacy flat + directory format)
// ---------------------------------------------------------------------------

/// Load skills from a legacy `commands/` directory.
///
/// Supports two formats:
/// - Directory format: `<name>/SKILL.md` (takes precedence over flat `.md`)
/// - Flat format: `<name>.md` or `<subdir>/<name>.md`
async fn load_skills_from_commands_dir(base_dir: &Path, source: SkillSource) -> Vec<LoadedSkill> {
    let mut results = Vec::new();
    collect_commands(base_dir, base_dir, source, &mut results).await;
    results
}

fn collect_commands<'a>(
    base_dir: &'a Path,
    dir: &'a Path,
    source: SkillSource,
    results: &'a mut Vec<LoadedSkill>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        let mut read_dir = match tokio::fs::read_dir(dir).await {
            Ok(rd) => rd,
            Err(_) => return,
        };

        // Collect all entries first so we can check for directory/flat conflicts
        let mut entries = Vec::new();
        while let Ok(Some(entry)) = read_dir.next_entry().await {
            entries.push(entry);
        }

        // Track names that have a directory format (to skip their flat counterpart)
        let mut dir_names: HashSet<String> = HashSet::new();

        // First pass: handle directory format
        for entry in &entries {
            let path = entry.path();
            // Follow symlinks: use metadata() which resolves symlink targets.
            let is_dir = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.is_dir(),
                Err(_) => continue,
            };

            if is_dir {
                // Use exact case-sensitive lookup to avoid false positives on
                // case-insensitive filesystems (e.g., macOS APFS).
                if let Some(skill_file) = find_exact_file(&path, "SKILL.md").await {
                    // Directory format — load it
                    if let Some(skill) = load_skill_file(
                        &skill_file,
                        base_dir,
                        &path,
                        source,
                        LoadChannel::CommandsDeprecated,
                    )
                    .await
                    {
                        let name = path
                            .file_name()
                            .map(|n| n.to_string_lossy().into_owned())
                            .unwrap_or_default();
                        dir_names.insert(name);
                        results.push(skill);
                    }
                } else {
                    // Recurse: this is a namespace subdirectory (e.g., db/migrate.md)
                    collect_commands(base_dir, &path, source, results).await;
                }
            }
        }

        // Second pass: handle flat .md files (skip if directory version exists)
        for entry in &entries {
            let path = entry.path();
            // Follow symlinks: use metadata() to check if this is a file (not a dir symlink).
            let is_file = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.is_file(),
                Err(_) => continue,
            };

            if is_file && path.extension().and_then(|e| e.to_str()) == Some("md") {
                let stem = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default();

                // Skip if a directory format was already loaded for this name
                if dir_names.contains(&stem) {
                    continue;
                }

                // The "skill directory" for flat files is their parent dir + stem
                let pseudo_dir = path.parent().unwrap_or(base_dir).join(&stem);
                if let Some(skill) = load_skill_file(
                    &path,
                    base_dir,
                    &pseudo_dir,
                    source,
                    LoadChannel::CommandsDeprecated,
                )
                .await
                {
                    results.push(skill);
                }
            }
        }
    })
}

// ---------------------------------------------------------------------------
// Internal: load a single skill file
// ---------------------------------------------------------------------------

/// Read, parse, and return a `LoadedSkill` for a single Markdown file.
/// Returns `None` if the file cannot be read.
async fn load_skill_file(
    file_path: &Path,
    base_dir: &Path,
    skill_dir: &Path,
    source: SkillSource,
    loaded_from: LoadChannel,
) -> Option<LoadedSkill> {
    let content = tokio::fs::read_to_string(file_path).await.ok()?;
    let parsed = parse_frontmatter(&content);

    let resolved_name = build_skill_namespace(base_dir, skill_dir);
    // skill_root is the directory containing SKILL.md (i.e., skill_dir itself),
    // used for ${flock_SKILL_DIR} variable substitution in skill content.
    let skill_root = Some(skill_dir.to_string_lossy().into_owned());

    let metadata = parse_skill_fields(
        &parsed.frontmatter,
        &parsed.content,
        &resolved_name,
        source,
        loaded_from,
        skill_root.as_deref(),
    );

    let resolved_path = try_canonicalize(file_path).unwrap_or_else(|| file_path.to_owned());

    Some(LoadedSkill {
        metadata,
        resolved_path,
    })
}

// ---------------------------------------------------------------------------
// Internal: namespace building
// ---------------------------------------------------------------------------

/// Build a colon-separated namespace from a directory hierarchy.
///
/// Examples:
/// - base=`<config_dir>/flock/skills`, target=`<config_dir>/flock/skills/db/migrate` → `"db:migrate"`
/// - base=`<config_dir>/flock/skills`, target=`<config_dir>/flock/skills/my-skill` → `"my-skill"`
pub(crate) fn build_skill_namespace(base_dir: &Path, target_dir: &Path) -> String {
    match target_dir.strip_prefix(base_dir) {
        Ok(relative) => relative
            .components()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(":"),
        Err(_) => target_dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
    }
}

// ---------------------------------------------------------------------------
// Internal: deduplication
// ---------------------------------------------------------------------------

/// Deduplicate loaded skills by canonical path. First occurrence wins.
fn deduplicate(skills: Vec<LoadedSkill>) -> Vec<SkillMetadata> {
    let mut seen: HashSet<PathBuf> = HashSet::new();
    let mut result = Vec::new();

    for skill in skills {
        if seen.insert(skill.resolved_path) {
            result.push(skill.metadata);
        }
    }

    result
}

/// Deduplicate by skill name (case-sensitive). First occurrence wins.
///
/// Called after path-based dedup to enforce priority between bundled, MCP,
/// and filesystem skills that share the same name but have different paths.
fn deduplicate_by_name(skills: Vec<SkillMetadata>) -> Vec<SkillMetadata> {
    let mut seen: HashMap<String, ()> = HashMap::new();
    let mut result = Vec::new();

    for skill in skills {
        if seen.insert(skill.name.clone(), ()).is_none() {
            result.push(skill);
        }
    }

    result
}

// ---------------------------------------------------------------------------
// Internal: safe canonicalize
// ---------------------------------------------------------------------------

/// Canonicalize a path, returning `None` if the path does not exist.
/// Never panics.
pub(crate) fn try_canonicalize(path: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(path).ok()
}

/// Find a file with an exact case-sensitive name inside `dir`.
///
/// On case-insensitive filesystems (e.g., macOS APFS), `Path::is_file()` may
/// return `true` for `SKILL.md` even when only `skill.md` exists.  This
/// function reads the directory entries and performs a byte-for-byte name
/// comparison to avoid false positives.
///
/// Returns `None` if no entry with that exact name exists or if the directory
/// cannot be read.
async fn find_exact_file(dir: &Path, name: &str) -> Option<PathBuf> {
    let mut rd = tokio::fs::read_dir(dir).await.ok()?;
    while let Ok(Some(entry)) = rd.next_entry().await {
        if entry.file_name().to_string_lossy() == name {
            let path = entry.path();
            let ft = entry.file_type().await.ok()?;
            if ft.is_file() {
                return Some(path);
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

