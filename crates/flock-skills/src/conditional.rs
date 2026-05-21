use std::collections::{HashMap, HashSet};
use std::path::Path;

use glob::Pattern;

use crate::types::SkillMetadata;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/// A dormant conditional skill with its pre-compiled glob patterns.
struct ConditionalEntry {
    skill: SkillMetadata,
    /// Pre-compiled glob patterns for efficient matching.
    /// Invalid patterns are skipped at compile time with a warning (C1).
    patterns: Vec<Pattern>,
}

// ---------------------------------------------------------------------------
// Public manager
// ---------------------------------------------------------------------------

/// Manages conditional skills (skills with `paths:` frontmatter).
///
/// Conditional skills start dormant and become active when the LLM operates
/// on files whose paths match the skill's `paths:` glob patterns.
///
/// # Matching semantics
///
/// Uses [`glob::Pattern`] for path matching. This covers the common cases
/// (`*.rs`, `src/**/*.ts`, etc.) but does **not** support `!` negation
/// patterns (unlike the TypeScript `ignore` library used in the reference implementation).
/// Invalid patterns are logged and skipped rather than causing a panic (C1).
///
/// # Concurrency
///
/// Not designed for concurrent access — caller wraps in `Arc<Mutex<>>` if needed.
pub struct ConditionalSkillManager {
    /// Dormant skills awaiting activation, keyed by skill name.
    dormant: HashMap<String, ConditionalEntry>,
    /// Activated skills, keyed by skill name.
    activated: HashMap<String, SkillMetadata>,
    /// Names of skills that have been activated (survives `clear_dormant` calls).
    activated_names: HashSet<String>,
}

impl Default for ConditionalSkillManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConditionalSkillManager {
    /// Create a new, empty manager.
    pub fn new() -> Self {
        Self {
            dormant: HashMap::new(),
            activated: HashMap::new(),
            activated_names: HashSet::new(),
        }
    }

    /// Separate conditional skills from a loaded skill list.
    ///
    /// Returns the unconditional skills; conditional ones are stored internally
    /// as dormant, awaiting path-based activation.
    ///
    /// Skills whose names are already in `activated_names` are treated as
    /// unconditional and returned directly (they survive cache reloads).
    ///
    /// # Multiple calls
    ///
    /// Subsequent calls with the same skill name overwrite the existing dormant
    /// entry (HashMap::insert semantics). To fully rebuild, call `clear_dormant()`
    /// before re-partitioning (C6).
    ///
    /// Aligns with TypeScript `loadSkillsDir.ts` L771-802.
    pub fn partition_skills(&mut self, skills: Vec<SkillMetadata>) -> Vec<SkillMetadata> {
        let mut unconditional = Vec::new();

        for skill in skills {
            // Conditional = has non-empty paths AND not yet activated
            if !skill.paths.is_empty() && !self.activated_names.contains(&skill.name) {
                let patterns = compile_patterns(&skill.name, &skill.paths);
                self.dormant
                    .insert(skill.name.clone(), ConditionalEntry { skill, patterns });
            } else {
                unconditional.push(skill);
            }
        }

        unconditional
    }

    /// Check file paths against dormant skills and activate any matches.
    ///
    /// `file_paths` are expected to be absolute paths; `cwd` is used to compute
    /// relative paths before matching. Paths outside `cwd` (starting with `..`
    /// after relativization, or still absolute on cross-drive systems) are
    /// skipped — they cannot match cwd-relative patterns.
    ///
    /// Returns the names of newly activated skills (empty if none matched).
    /// The order of returned names is not guaranteed (HashMap iteration order).
    ///
    /// Aligns with TypeScript `activateConditionalSkillsForPaths` L997-1058.
    pub fn activate_for_paths(&mut self, file_paths: &[&str], cwd: &str) -> Vec<String> {
        if self.dormant.is_empty() {
            return Vec::new();
        }

        let cwd_path = Path::new(cwd);

        // Collect names to activate first (cannot mutate dormant while iterating it)
        let mut to_activate: Vec<String> = Vec::new();

        'outer: for (name, entry) in &self.dormant {
            for &file_path in file_paths {
                let rel = match relativize(file_path, cwd_path) {
                    Some(r) => r,
                    None => continue,
                };

                for pattern in &entry.patterns {
                    if pattern.matches(&rel) {
                        eprintln!(
                            "[skills] Activated conditional skill '{}' (matched path: {})",
                            name, rel
                        );
                        to_activate.push(name.clone());
                        continue 'outer;
                    }
                }
            }
        }

        // Apply activations: move from dormant → activated
        for name in &to_activate {
            if let Some(entry) = self.dormant.remove(name) {
                self.activated_names.insert(name.clone());
                self.activated.insert(name.clone(), entry.skill);
            }
        }

        to_activate
    }

    /// Retrieve a specific activated skill by name.
    ///
    /// Used by SkillTool to fetch the skill definition on invocation.
    pub fn get_activated(&self, name: &str) -> Option<&SkillMetadata> {
        self.activated.get(name)
    }

    /// Get all currently activated skills.
    ///
    /// Used for prompt listing.
    pub fn get_all_activated(&self) -> Vec<&SkillMetadata> {
        self.activated.values().collect()
    }

    /// Returns the number of skills currently dormant.
    pub fn dormant_count(&self) -> usize {
        self.dormant.len()
    }

    /// Clear dormant skills (e.g., when reloading from disk).
    ///
    /// `activated_names` is preserved so previously activated skills remain
    /// treated as unconditional on the next `partition_skills` call.
    pub fn clear_dormant(&mut self) {
        self.dormant.clear();
    }

    /// Full reset: clear dormant skills, activated skills, and activated names.
    ///
    /// Corresponds to the TypeScript `clearDynamicSkills()` (L1070-1075) which
    /// also clears `activatedConditionalSkillNames`. Use when a complete session
    /// reset is needed (C5).
    pub fn reset_all(&mut self) {
        self.dormant.clear();
        self.activated.clear();
        self.activated_names.clear();
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Compile a list of glob pattern strings into [`Pattern`] instances.
///
/// Invalid patterns (e.g., those containing `!` negation which is not supported
/// by `glob::Pattern`) are logged and skipped rather than panicking (C1).
fn compile_patterns(skill_name: &str, raw_patterns: &[String]) -> Vec<Pattern> {
    raw_patterns
        .iter()
        .filter_map(|p| match Pattern::new(p) {
            Ok(pat) => Some(pat),
            Err(e) => {
                eprintln!(
                    "[skills] Skill '{}': invalid glob pattern '{}' — skipped ({}). \
                     Note: `!` negation patterns are not supported (use glob syntax instead).",
                    skill_name, p, e
                );
                None
            }
        })
        .collect()
}

/// Convert `file_path` to a path relative to `cwd`.
///
/// Returns `None` for paths that:
/// - are empty after relativization
/// - escape `cwd` (start with `..`)
/// - remain absolute (cross-drive on Windows)
///
/// Aligns with TypeScript guard at L1019-1027.
fn relativize(file_path: &str, cwd: &Path) -> Option<String> {
    let abs = Path::new(file_path);

    let rel = if abs.is_absolute() {
        match abs.strip_prefix(cwd) {
            Ok(r) => r.to_string_lossy().into_owned(),
            // strip_prefix fails when abs is not under cwd — treat as outside
            Err(_) => return None,
        }
    } else {
        file_path.to_owned()
    };

    if rel.is_empty() || rel.starts_with("..") || Path::new(&rel).is_absolute() {
        return None;
    }

    // Normalise separators to forward-slash for glob matching consistency
    Some(rel.replace('\\', "/"))
}


