use serde::{Deserialize, Serialize};

// Re-export EffortLevel from flock-types (single source of truth)
pub use flock_core::types::skill_types::EffortLevel;

/// Raw fields from skill frontmatter (YAML deserialization target).
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct FrontmatterData {
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "allowed-tools")]
    pub allowed_tools: Option<StringOrVec>,
    #[serde(rename = "argument-hint")]
    pub argument_hint: Option<String>,
    pub arguments: Option<StringOrVec>,
    #[serde(rename = "when-to-use")]
    pub when_to_use: Option<String>,
    pub version: Option<String>,
    pub model: Option<String>,
    pub effort: Option<StringOrNumber>,
    /// "inline" | "fork"
    pub context: Option<String>,
    pub agent: Option<String>,
    pub paths: Option<StringOrVec>,
    /// "bash" only — PowerShell not supported
    pub shell: Option<String>,
    #[serde(rename = "user-invocable")]
    pub user_invocable: Option<BoolOrString>,
    #[serde(rename = "hide-from-slash-command-tool")]
    pub hide_from_model_invocation: Option<BoolOrString>,
    /// Raw hooks YAML — converted to serde_json::Value in SkillMetadata (Phase 11 will parse fully)
    pub hooks: Option<serde_yaml::Value>,
    #[serde(rename = "type")]
    pub skill_type: Option<String>,
    pub skills: Option<String>,
    // No serde(flatten) + HashMap — known serde_yaml bug with that combination
}

/// String or list of strings (used for allowed-tools, paths, arguments, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StringOrVec {
    Single(String),
    Multiple(Vec<String>),
}

/// String or integer (used for effort field)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StringOrNumber {
    Str(String),
    Num(i64),
}

/// Boolean or "true"/"false" string (used for user-invocable, hide-from-slash-command-tool)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum BoolOrString {
    Bool(bool),
    Str(String),
}

/// Parsed frontmatter plus body content.
#[derive(Debug, Clone)]
pub struct ParsedMarkdown {
    pub frontmatter: FrontmatterData,
    pub content: String,
}

/// Skill execution context.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionContext {
    Inline,
    Fork,
}

/// Where the skill file originates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkillSource {
    /// `<config_dir>/flock/skills/`
    User,
    /// .flock/skills/ (project-level)
    Project,
    /// .flock/.managed/skills/
    Managed,
    /// Built-in bundled skills
    Bundled,
    /// Loaded via MCP ipc_interface
    Mcp,
    /// .flock/commands/ (legacy compatibility)
    Legacy,
}

/// How the skill was discovered during loading.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadChannel {
    Skills,
    CommandsDeprecated,
    Managed,
    Bundled,
    Mcp,
}

/// Normalized skill metadata, derived from FrontmatterData.
#[derive(Debug, Clone)]
pub struct SkillMetadata {
    pub name: String,
    pub display_name: Option<String>,
    pub description: String,
    pub has_user_specified_description: bool,
    pub allowed_tools: Vec<String>,
    pub argument_hint: Option<String>,
    pub argument_names: Vec<String>,
    pub when_to_use: Option<String>,
    pub version: Option<String>,
    /// None means "don't override"; "inherit" in frontmatter is normalized to None
    pub model: Option<String>,
    pub disable_model_invocation: bool,
    pub user_invocable: bool,
    pub execution_context: ExecutionContext,
    pub agent: Option<String>,
    pub effort: Option<EffortLevel>,
    /// "bash" only
    pub shell: Option<String>,
    /// Glob patterns after brace expansion
    pub paths: Vec<String>,
    /// Hooks converted from serde_yaml::Value — full parse deferred to Phase 11
    pub hooks_raw: Option<serde_json::Value>,
    pub source: SkillSource,
    pub loaded_from: LoadChannel,
    /// Body content after frontmatter
    pub content: String,
    /// Character count of body (approximate token estimate: ~4 chars/token for English, not exact)
    pub content_length: usize,
    /// Directory containing the skill file
    pub skill_root: Option<String>,
}
