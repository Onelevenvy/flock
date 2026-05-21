use std::path::PathBuf;
use crate::types::SkillMetadata;

/// A loaded skill paired with its canonical filesystem path for deduplication.
pub struct LoadedSkill {
    pub metadata: SkillMetadata,
    /// Canonicalized path used for dedup (symlinks resolved, `.`/`..` removed).
    pub resolved_path: PathBuf,
}
