use crate::types::SkillMetadata;

// Re-export from flock-types so callers can use a single import path
pub use flock_core::types::skill_types::{effort_to_string, ContextModifier};

/// Build a ContextModifier from skill metadata. Returns None if no overrides are specified.
pub fn from_skill_metadata(skill: &SkillMetadata) -> Option<ContextModifier> {
    let has_overrides =
        skill.model.is_some() || skill.effort.is_some() || !skill.allowed_tools.is_empty();

    if !has_overrides {
        return None;
    }

    Some(ContextModifier {
        model: skill.model.clone(),
        effort: skill.effort,
        allowed_tools: skill.allowed_tools.clone(),
        ..Default::default()
    })
}
