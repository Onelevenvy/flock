use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::loader::{load_skills_from_dir, LoadedSkill};
use crate::types::{LoadChannel, SkillMetadata, SkillSource};

// ---------------------------------------------------------------------------
// Public manager
// ---------------------------------------------------------------------------

/// Manages runtime discovery of `.flock/skills/` directories found in
/// subdirectories when the LLM operates on files.
///
/// CWD-level skills are loaded at startup; this manager handles dynamically
/// discovered skills in directories nested below the CWD.
///
/// # Concurrency
///
/// Not designed for concurrent access — caller wraps in `Arc<Mutex<>>` if needed.
pub struct RuntimeDiscovery {
    /// Directories already checked (both hits and misses) — avoids repeated stat.
    checked_dirs: HashSet<PathBuf>,
    /// Skills loaded from dynamically discovered directories, keyed by skill name.
    dynamic_skills: HashMap<String, SkillMetadata>,
}

impl Default for RuntimeDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

impl RuntimeDiscovery {
    /// Create a new, empty discovery manager.
    pub fn new() -> Self {
        Self {
            checked_dirs: HashSet::new(),
            dynamic_skills: HashMap::new(),
        }
    }

    /// Discover `.flock/skills/` directories by walking up from each file path to `cwd`.
    ///
    /// Only discovers directories **below** `cwd` (cwd-level skills are loaded at
    /// startup). Already-checked directories are skipped to avoid redundant stat
    /// calls on every Read/Write/Edit operation.
    ///
    /// Directories belonging to gitignored paths are silently skipped via
    /// `git check-ignore`. The check fails open (returns `false`) outside a git
    /// repository or when the `git` binary is unavailable.
    ///
    /// Returns newly discovered skill directories sorted deepest-first so that
    /// skills closer to the file take precedence when names conflict.
    ///
    /// Aligns with TypeScript `discoverSkillDirsForPaths` L861-915.
    pub async fn discover_dirs_for_paths(
        &mut self,
        file_paths: &[&str],
        cwd: &str,
    ) -> Vec<PathBuf> {
        // Normalise cwd: strip trailing separator to avoid prefix-match false positives
        let resolved_cwd = cwd.trim_end_matches(std::path::MAIN_SEPARATOR);
        let cwd_with_sep = format!("{}{}", resolved_cwd, std::path::MAIN_SEPARATOR);

        let mut new_dirs: Vec<PathBuf> = Vec::new();

        for &file_path in file_paths {
            let file = Path::new(file_path);
            let Some(parent) = file.parent() else {
                continue;
            };

            let mut current = parent.to_path_buf();

            // Walk up toward cwd but NOT including cwd itself
            // Use prefix+separator check to avoid /project-backup matching when cwd=/project
            loop {
                let current_str = current.to_string_lossy();
                if !current_str.starts_with(&*cwd_with_sep) {
                    break;
                }

                let skill_dir = current.join(".flock").join("skills");

                if !self.checked_dirs.contains(&skill_dir) {
                    self.checked_dirs.insert(skill_dir.clone());

                    if tokio::fs::metadata(&skill_dir).await.is_ok() {
                        // Check if the containing directory (currentDir = skill_dir's
                        // grandparent) is gitignored. Aligns with TS L892 which passes
                        // `currentDir` (not skillDir) to isPathGitignored (C4).
                        let containing_dir = skill_dir
                            .parent() // .flock/
                            .and_then(|p| p.parent()) // currentDir
                            .unwrap_or(&current);

                        if is_path_gitignored(containing_dir, resolved_cwd).await {
                            eprintln!(
                                "[skills] Skipped gitignored skills dir: {}",
                                skill_dir.display()
                            );
                        } else {
                            new_dirs.push(skill_dir);
                        }
                    }
                }

                // Move to parent
                let parent_dir = match current.parent() {
                    Some(p) if p != current => p.to_path_buf(),
                    _ => break, // Reached filesystem root
                };
                current = parent_dir;
            }
        }

        // Sort deepest-first: more path components = deeper
        new_dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));

        new_dirs
    }

    /// Load skills from newly discovered directories and merge into dynamic skills.
    ///
    /// Directories should be sorted deepest-first (as returned by
    /// `discover_dirs_for_paths`). Deeper directories take precedence: when two
    /// skills share a name, the one from the deeper directory wins.
    ///
    /// Only prompt-type skills are merged (skills with no `skill_type` or
    /// `skill_type == "prompt"`), aligning with TS `addSkillDirectories` L947 (C8).
    ///
    /// Returns the count of newly merged skills.
    pub async fn add_skill_directories(&mut self, dirs: &[PathBuf]) -> usize {
        if dirs.is_empty() {
            return 0;
        }

        // Load all directories in parallel-ish (sequential here for simplicity;
        // the dirs slice is typically small — one per recently-touched file).
        let mut loaded_batches: Vec<Vec<LoadedSkill>> = Vec::with_capacity(dirs.len());
        for dir in dirs {
            let batch = load_skills_from_dir(dir, SkillSource::Project, LoadChannel::Skills).await;
            loaded_batches.push(batch);
        }

        let previous_count = self.dynamic_skills.len();

        // Process in reverse order (shallowest first) so deeper entries override.
        // `dirs` is already deepest-first, so reversing gives shallowest-first.
        for batch in loaded_batches.iter().rev() {
            for loaded in batch {
                if is_prompt_type(&loaded.metadata) {
                    self.dynamic_skills
                        .insert(loaded.metadata.name.clone(), loaded.metadata.clone());
                }
            }
        }

        let new_count = self.dynamic_skills.len();
        // Net increase in unique skill names. Replacements of existing skills
        // (same name, deeper directory) are not counted — this is a rough
        // "newly visible" metric for logging, not a total-loaded count.
        let added = new_count.saturating_sub(previous_count);

        if added > 0 {
            eprintln!(
                "[skills] Dynamically discovered {} new skill(s) from {} director(ies)",
                added,
                dirs.len()
            );
        }

        added
    }

    /// Get all dynamically discovered skills.
    pub fn get_dynamic_skills(&self) -> Vec<&SkillMetadata> {
        self.dynamic_skills.values().collect()
    }

    /// Clear dynamic skills (e.g., when reloading the skill set).
    ///
    /// `checked_dirs` is preserved to avoid redundant stat calls for directories
    /// already known not to contain a `.flock/skills/` subdirectory.
    pub fn clear_dynamic_skills(&mut self) {
        self.dynamic_skills.clear();
    }

    /// Clear the set of directories that have already been checked for
    /// `.flock/skills/` subdirectories.
    ///
    /// Call this when a file-system watcher detects changes so that newly
    /// created directories (or directories that were previously absent) are
    /// re-examined on the next [`discover_dirs_for_paths`](Self::discover_dirs_for_paths) call.
    pub fn clear_checked_dirs(&mut self) {
        self.checked_dirs.clear();
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Check whether `path` is gitignored using `git check-ignore -q`.
///
/// Exit code 0 means the path is ignored; any non-zero exit or command failure
/// means "not ignored" (fail-open design — safe outside git repositories).
///
/// `cwd` is used as the working directory for the `git` process so that
/// `.gitignore` files are resolved relative to the project root.
///
/// Aligns with TypeScript `isPathGitignored` referenced at L892.
async fn is_path_gitignored(path: &Path, cwd: &str) -> bool {
    let result = tokio::process::Command::new("git")
        .arg("check-ignore")
        .arg("-q")
        .arg(path)
        .current_dir(cwd)
        .output()
        .await;

    match result {
        Ok(output) => output.status.success(),
        Err(_) => false, // git unavailable or other I/O error — fail open
    }
}

/// Returns `true` if the skill is a prompt-type skill (the default when no
/// `skill_type` is set) or explicitly typed as `"prompt"`.
///
/// Aligns with TypeScript `addSkillDirectories` L947: `skill.type === 'prompt'` (C8).
fn is_prompt_type(_skill: &SkillMetadata) -> bool {
    // SkillMetadata does not expose skill_type as a parsed field yet.
    // All skills loaded via load_skills_from_dir are treated as prompt type.
    // Update when SkillMetadata gains a skill_type field.
    true
}


