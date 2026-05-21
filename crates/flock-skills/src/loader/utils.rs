use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use crate::types::SkillMetadata;
use super::types::LoadedSkill;

/// Deduplicate loaded skills by canonical path. First occurrence wins.
pub fn deduplicate(skills: Vec<LoadedSkill>) -> Vec<SkillMetadata> {
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
pub fn deduplicate_by_name(skills: Vec<SkillMetadata>) -> Vec<SkillMetadata> {
    let mut seen: HashMap<String, ()> = HashMap::new();
    let mut result = Vec::new();

    for skill in skills {
        if seen.insert(skill.name.clone(), ()).is_none() {
            result.push(skill);
        }
    }

    result
}

pub fn try_canonicalize(path: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(path).ok()
}

pub async fn find_exact_file(dir: &Path, name: &str) -> Option<PathBuf> {
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
