use crate::types::SkillMetadata;

/// A parsed permission rule for skill name matching.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PermissionRule {
    /// Exact name match: `"commit"` matches only `"commit"`.
    Exact(String),
    /// Prefix match with trailing colon: `"db:*"` is stored as `Prefix("db:")`.
    /// Stored WITH the colon to prevent `"db:*"` from matching `"database"`.
    Prefix(String),
}

impl PermissionRule {
    /// Parse a rule string.
    /// - `"db:*"` → `Prefix("db:")` (trailing `*` stripped, colon kept)
    /// - `"commit"` → `Exact("commit")`
    pub fn parse(rule: &str) -> Self {
        if let Some(prefix) = rule.strip_suffix('*') {
            PermissionRule::Prefix(prefix.to_string())
        } else {
            PermissionRule::Exact(rule.to_string())
        }
    }

    /// Returns true if this rule matches the given skill name.
    pub fn matches(&self, name: &str) -> bool {
        match self {
            PermissionRule::Exact(s) => s == name,
            PermissionRule::Prefix(p) => name.starts_with(p.as_str()),
        }
    }
}

/// Result of a skill permission check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkillPermission {
    /// Skill is allowed to execute.
    Allow,
    /// Skill is denied by configuration (always blocks, even with auto_approve).
    Deny,
    /// Skill requires user confirmation before execution.
    Ask { reason: String },
}

/// Checks whether a specific skill is allowed to execute.
///
/// Decision chain (evaluated in order):
/// 1. deny rules  → `Deny`  (always enforced, even when `auto_approve = true`)
/// 2. allow rules → `Allow`
/// 3. safe-properties: `hooks_raw.is_none() && allowed_tools.is_empty()` → `Allow`
/// 4. `auto_approve` flag → `Allow` (converts what would be `Ask` into `Allow`)
/// 5. fallback → `Ask { reason }`
pub struct SkillPermissionChecker {
    deny_rules: Vec<PermissionRule>,
    allow_rules: Vec<PermissionRule>,
    /// When true, Step 4 converts Ask → Allow (but does not bypass Deny).
    auto_approve: bool,
}

impl SkillPermissionChecker {
    /// Create a checker from config deny/allow string lists.
    pub fn new(deny: Vec<String>, allow: Vec<String>, auto_approve: bool) -> Self {
        Self {
            deny_rules: deny.iter().map(|s| PermissionRule::parse(s)).collect(),
            allow_rules: allow.iter().map(|s| PermissionRule::parse(s)).collect(),
            auto_approve,
        }
    }

    /// Run the 5-step permission decision chain.
    pub fn check(&self, skill: &SkillMetadata) -> SkillPermission {
        let name = &skill.name;

        // Step 1: deny rules always win.
        if self.deny_rules.iter().any(|r| r.matches(name)) {
            return SkillPermission::Deny;
        }

        // Step 2: explicit allow.
        if self.allow_rules.iter().any(|r| r.matches(name)) {
            return SkillPermission::Allow;
        }

        // Step 3: safe-properties.
        // Note: hooks_raw is Option<serde_json::Value> (None check),
        // allowed_tools is Vec<String> (is_empty check). The two differ by design.
        let is_safe = skill.hooks_raw.is_none() && skill.allowed_tools.is_empty();
        if is_safe {
            return SkillPermission::Allow;
        }

        // Step 4: auto_approve converts Ask → Allow.
        if self.auto_approve {
            return SkillPermission::Allow;
        }

        // Step 5: require user confirmation.
        let reason = build_ask_reason(skill);
        SkillPermission::Ask { reason }
    }
}

/// Build a human-readable reason string for why a skill needs confirmation.
fn build_ask_reason(skill: &SkillMetadata) -> String {
    match (skill.hooks_raw.is_some(), !skill.allowed_tools.is_empty()) {
        (true, true) => format!(
            "Skill '{}' declares hooks and allowed-tools which grant elevated privileges.",
            skill.name
        ),
        (true, false) => format!(
            "Skill '{}' declares hooks which may run arbitrary shell commands.",
            skill.name
        ),
        (false, true) => format!(
            "Skill '{}' declares allowed-tools ({}) which grant elevated tool access.",
            skill.name,
            skill.allowed_tools.join(", ")
        ),
        (false, false) => {
            // Should not reach here (safe-properties would have allowed), but be defensive.
            format!("Skill '{}' requires user approval.", skill.name)
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ExecutionContext, LoadChannel, SkillMetadata, SkillSource};

    fn make_skill(name: &str) -> SkillMetadata {
        SkillMetadata {
            name: name.to_string(),
            display_name: None,
            description: String::new(),
            has_user_specified_description: false,
            allowed_tools: vec![],
            argument_hint: None,
            argument_names: vec![],
            when_to_use: None,
            version: None,
            model: None,
            disable_model_invocation: false,
            user_invocable: true,
            execution_context: ExecutionContext::Inline,
            agent: None,
            effort: None,
            shell: None,
            paths: vec![],
            hooks_raw: None,
            source: SkillSource::User,
            loaded_from: LoadChannel::Skills,
            content: String::new(),
            content_length: 0,
            skill_root: None,
        }
    }

    // P5-1: parse exact match
    #[test]
    fn p5_1_parse_exact() {
        let rule = PermissionRule::parse("commit");
        assert_eq!(rule, PermissionRule::Exact("commit".to_string()));
        assert!(rule.matches("commit"));
        assert!(!rule.matches("commit-all"));
    }

    // P5-2: parse prefix match
    #[test]
    fn p5_2_parse_prefix() {
        let rule = PermissionRule::parse("db:*");
        assert_eq!(rule, PermissionRule::Prefix("db:".to_string()));
        assert!(rule.matches("db:migrate"));
        assert!(rule.matches("db:seed"));
        assert!(!rule.matches("database"));
    }

    // P5-3: deny rule blocks skill
    #[test]
    fn p5_3_deny_blocks_skill() {
        let checker = SkillPermissionChecker::new(vec!["dangerous".to_string()], vec![], false);
        let skill = make_skill("dangerous");
        assert_eq!(checker.check(&skill), SkillPermission::Deny);
    }

    // P5-4: allow rule passes skill
    #[test]
    fn p5_4_allow_passes_skill() {
        let mut skill = make_skill("commit");
        // Give it hooks so safe-properties wouldn't fire
        skill.hooks_raw = Some(serde_json::json!({}));
        let checker = SkillPermissionChecker::new(vec![], vec!["commit".to_string()], false);
        assert_eq!(checker.check(&skill), SkillPermission::Allow);
    }

    // P5-5: deny takes priority over allow
    #[test]
    fn p5_5_deny_over_allow() {
        let mut skill = make_skill("commit");
        skill.hooks_raw = Some(serde_json::json!({}));
        let checker = SkillPermissionChecker::new(
            vec!["commit".to_string()],
            vec!["commit".to_string()],
            false,
        );
        assert_eq!(checker.check(&skill), SkillPermission::Deny);
    }

    // P5-6: no hooks, no allowed_tools → Allow (safe-properties)
    #[test]
    fn p5_6_safe_properties_allow() {
        let checker = SkillPermissionChecker::new(vec![], vec![], false);
        let skill = make_skill("read-only");
        assert_eq!(checker.check(&skill), SkillPermission::Allow);
    }

    // P5-7: has hooks → Ask
    #[test]
    fn p5_7_hooks_require_ask() {
        let mut skill = make_skill("hooked");
        skill.hooks_raw = Some(serde_json::json!({ "pre": "echo hi" }));
        let checker = SkillPermissionChecker::new(vec![], vec![], false);
        assert!(matches!(checker.check(&skill), SkillPermission::Ask { .. }));
    }

    // P5-8: has allowed_tools → Ask
    #[test]
    fn p5_8_allowed_tools_require_ask() {
        let mut skill = make_skill("tooled");
        skill.allowed_tools = vec!["Bash".to_string()];
        let checker = SkillPermissionChecker::new(vec![], vec![], false);
        assert!(matches!(checker.check(&skill), SkillPermission::Ask { .. }));
    }

    // P5-9: no rule match + has hooks → Ask
    #[test]
    fn p5_9_no_match_with_hooks_ask() {
        let mut skill = make_skill("unknown");
        skill.hooks_raw = Some(serde_json::json!({}));
        let checker = SkillPermissionChecker::new(
            vec!["other".to_string()],
            vec!["other".to_string()],
            false,
        );
        assert!(matches!(checker.check(&skill), SkillPermission::Ask { .. }));
    }

    // P5-10: auto_approve converts Ask → Allow (but deny still blocks)
    #[test]
    fn p5_10_auto_approve_allows_but_not_deny() {
        let mut skill_hooked = make_skill("hooked");
        skill_hooked.hooks_raw = Some(serde_json::json!({}));

        let mut skill_denied = make_skill("denied");
        skill_denied.hooks_raw = Some(serde_json::json!({}));

        let checker = SkillPermissionChecker::new(
            vec!["denied".to_string()],
            vec![],
            true, // auto_approve
        );

        // hooked skill: would be Ask, but auto_approve converts to Allow
        assert_eq!(checker.check(&skill_hooked), SkillPermission::Allow);
        // denied skill: deny always wins
        assert_eq!(checker.check(&skill_denied), SkillPermission::Deny);
    }

    // P5-13: prefix boundary — "db:*" does not match "database"
    #[test]
    fn p5_13_prefix_boundary() {
        let rule = PermissionRule::parse("db:*");
        assert!(!rule.matches("database"));
        assert!(!rule.matches("db"));
        assert!(rule.matches("db:migrate"));
        assert!(rule.matches("db:"));
    }

    // P5-15: empty deny/allow → all go through safe-properties
    #[test]
    fn p5_15_empty_rules_safe_properties() {
        let checker = SkillPermissionChecker::new(vec![], vec![], false);

        // Safe skill (no hooks, no allowed_tools) → Allow
        let safe = make_skill("safe");
        assert_eq!(checker.check(&safe), SkillPermission::Allow);

        // Unsafe skill (has hooks) → Ask
        let mut unsafe_skill = make_skill("unsafe");
        unsafe_skill.hooks_raw = Some(serde_json::json!({}));
        assert!(matches!(
            checker.check(&unsafe_skill),
            SkillPermission::Ask { .. }
        ));
    }

    // Reason string mentions hooks
    #[test]
    fn ask_reason_mentions_hooks() {
        let mut skill = make_skill("hooked");
        skill.hooks_raw = Some(serde_json::json!({}));
        let checker = SkillPermissionChecker::new(vec![], vec![], false);
        if let SkillPermission::Ask { reason } = checker.check(&skill) {
            assert!(
                reason.contains("hooks"),
                "reason should mention hooks: {reason}"
            );
        } else {
            panic!("expected Ask");
        }
    }

    // Reason string mentions allowed-tools
    #[test]
    fn ask_reason_mentions_allowed_tools() {
        let mut skill = make_skill("tooled");
        skill.allowed_tools = vec!["Bash".to_string()];
        let checker = SkillPermissionChecker::new(vec![], vec![], false);
        if let SkillPermission::Ask { reason } = checker.check(&skill) {
            assert!(
                reason.contains("allowed-tools") || reason.contains("Bash"),
                "reason should mention tool: {reason}"
            );
        } else {
            panic!("expected Ask");
        }
    }
}
