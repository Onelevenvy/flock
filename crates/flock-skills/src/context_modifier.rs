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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ExecutionContext, LoadChannel, SkillSource};
    use flock_core::types::skill_types::EffortLevel;

    fn make_skill(
        model: Option<&str>,
        effort: Option<EffortLevel>,
        allowed_tools: Vec<String>,
    ) -> SkillMetadata {
        SkillMetadata {
            name: "test".to_string(),
            display_name: None,
            description: String::new(),
            has_user_specified_description: false,
            allowed_tools,
            argument_hint: None,
            argument_names: Vec::new(),
            when_to_use: None,
            version: None,
            model: model.map(str::to_owned),
            disable_model_invocation: false,
            user_invocable: true,
            execution_context: ExecutionContext::Inline,
            agent: None,
            effort,
            shell: None,
            paths: Vec::new(),
            hooks_raw: None,
            source: SkillSource::User,
            loaded_from: LoadChannel::Skills,
            content: String::new(),
            content_length: 0,
            skill_root: None,
        }
    }

    #[test]
    fn test_from_skill_no_overrides_returns_none() {
        let skill = make_skill(None, None, vec![]);
        assert!(from_skill_metadata(&skill).is_none());
    }

    #[test]
    fn test_from_skill_model_override() {
        let skill = make_skill(Some("claude-opus-4-6"), None, vec![]);
        let m = from_skill_metadata(&skill).unwrap();
        assert_eq!(m.model.as_deref(), Some("claude-opus-4-6"));
        assert!(m.effort.is_none());
        assert!(m.allowed_tools.is_empty());
    }

    #[test]
    fn test_from_skill_effort_override() {
        let skill = make_skill(None, Some(EffortLevel::High), vec![]);
        let m = from_skill_metadata(&skill).unwrap();
        assert!(m.model.is_none());
        assert_eq!(m.effort, Some(EffortLevel::High));
    }

    #[test]
    fn test_from_skill_allowed_tools_override() {
        let skill = make_skill(None, None, vec!["Bash".to_string(), "Read".to_string()]);
        let m = from_skill_metadata(&skill).unwrap();
        assert_eq!(m.allowed_tools, vec!["Bash", "Read"]);
    }

    #[test]
    fn test_from_skill_all_overrides() {
        let skill = make_skill(
            Some("gpt-4o"),
            Some(EffortLevel::Low),
            vec!["Write".to_string()],
        );
        let m = from_skill_metadata(&skill).unwrap();
        assert_eq!(m.model.as_deref(), Some("gpt-4o"));
        assert_eq!(m.effort, Some(EffortLevel::Low));
        assert_eq!(m.allowed_tools, vec!["Write"]);
    }

    #[test]
    fn test_is_empty_on_default() {
        let m = ContextModifier::default();
        assert!(m.is_empty());
    }

    #[test]
    fn test_is_empty_false_when_model_set() {
        let m = ContextModifier {
            model: Some("x".to_string()),
            ..Default::default()
        };
        assert!(!m.is_empty());
    }

    #[test]
    fn test_effort_to_string_all_variants() {
        assert_eq!(effort_to_string(EffortLevel::Low), "low");
        assert_eq!(effort_to_string(EffortLevel::Medium), "medium");
        assert_eq!(effort_to_string(EffortLevel::High), "high");
        assert_eq!(effort_to_string(EffortLevel::Max), "max");
    }
}
