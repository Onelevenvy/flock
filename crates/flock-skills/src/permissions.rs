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

