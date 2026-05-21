use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::spawner::Spawner;
use flock_core::config::hooks::HooksConfig;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{JsonSchema, ToolResult};
use flock_skills::context_modifier::ContextModifier;
use flock_skills::executor::{execute_fork, prepare_inline_content};
use flock_skills::hooks::{parse_skill_hooks, to_hook_defs};
use flock_skills::permissions::{SkillPermission, SkillPermissionChecker};
use flock_skills::types::{ExecutionContext, SkillMetadata};

use flock_tools::Tool;

/// A tool that allows the LLM to invoke named skills.
///
/// Each skill is looked up by name (exact match, leading `/` stripped),
/// its content is prepared with variable substitution and shell execution,
/// and returned as a `ToolResult`.  The Skill list is injected into the
/// system prompt in Phase 9; this tool's `description()` returns a fixed string.
pub struct SkillTool {
    skills: Arc<Vec<SkillMetadata>>,
    /// Working directory for shell command execution inside skill content.
    cwd: String,
    /// Permission checker for skill-level deny/allow rules.
    checker: SkillPermissionChecker,
    /// Session ID passed to prepare_inline_content for ${flock_SESSION_ID} substitution.
    /// None if sessions are disabled or not yet initialised.
    session_id: Option<String>,
    /// Spawner for fork-mode skills. None when SkillTool is built without fork support.
    spawner: Option<Arc<dyn Spawner>>,
}

impl SkillTool {
    pub fn new(
        skills: Arc<Vec<SkillMetadata>>,
        cwd: String,
        checker: SkillPermissionChecker,
    ) -> Self {
        Self {
            skills,
            cwd,
            checker,
            session_id: None,
            spawner: None,
        }
    }

    /// Create a SkillTool with a known session ID.
    pub fn with_session_id(
        skills: Arc<Vec<SkillMetadata>>,
        cwd: String,
        checker: SkillPermissionChecker,
        session_id: Option<String>,
    ) -> Self {
        Self {
            skills,
            cwd,
            checker,
            session_id,
            spawner: None,
        }
    }

    /// Create a SkillTool with full fork-mode support.
    pub fn with_spawner(
        skills: Arc<Vec<SkillMetadata>>,
        cwd: String,
        checker: SkillPermissionChecker,
        session_id: Option<String>,
        spawner: Option<Arc<dyn Spawner>>,
    ) -> Self {
        Self {
            skills,
            cwd,
            checker,
            session_id,
            spawner,
        }
    }

    /// Find a skill by exact name (case-sensitive, leading `/` stripped).
    fn find_skill(&self, name: &str) -> Option<&SkillMetadata> {
        let name = name.trim_start_matches('/');
        self.skills.iter().find(|s| s.name == name)
    }

    /// Build a comma-separated list of available skill names for error messages.
    fn available_names(&self) -> String {
        self.skills
            .iter()
            .map(|s| s.name.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    }
}

#[async_trait]
impl Tool for SkillTool {
    fn name(&self) -> &str {
        "Skill"
    }

    fn description(&self) -> &str {
        "Invoke a named skill by name. \
         Use the skill name exactly as listed in the system prompt. \
         Optionally pass arguments as a single string."
    }

    fn input_schema(&self) -> JsonSchema {
        json!({
            "type": "object",
            "properties": {
                "skill": {
                    "type": "string",
                    "description": "The skill name. E.g., \"commit\", \"review-pr\", or \"pdf\""
                },
                "args": {
                    "type": "string",
                    "description": "Optional arguments for the skill"
                }
            },
            "required": ["skill"]
        })
    }

    fn is_concurrency_safe(&self, _input: &Value) -> bool {
        // Skills may modify context; conservatively mark as not concurrency-safe.
        false
    }

    async fn execute(&self, input: Value) -> ToolResult {
        let Some(skill_name) = input["skill"].as_str() else {
            return ToolResult {
                content: "Missing required parameter: skill".to_string(),
                is_error: true,
            };
        };

        let skill = match self.find_skill(skill_name) {
            Some(s) => s,
            None => {
                let available = self.available_names();
                return ToolResult {
                    content: format!(
                        "Skill '{}' not found. Available skills: {}",
                        skill_name, available
                    ),
                    is_error: true,
                };
            }
        };

        // Check skill-level permissions (applies to both inline and fork modes).
        match self.checker.check(skill) {
            SkillPermission::Deny => {
                return ToolResult {
                    content: format!("Skill '{}' is denied by configuration.", skill.name),
                    is_error: true,
                };
            }
            SkillPermission::Ask { reason } => {
                return ToolResult {
                    content: format!(
                        "Skill '{}' requires user approval before execution. \
                         {} \
                         Please ask the user to approve this skill in their configuration.",
                        skill.name, reason
                    ),
                    is_error: true,
                };
            }
            SkillPermission::Allow => {}
        }

        let args = input["args"].as_str();

        match skill.execution_context {
            ExecutionContext::Inline => {
                match prepare_inline_content(skill, args, self.session_id.as_deref(), &self.cwd)
                    .await
                {
                    Ok(content) => ToolResult {
                        content,
                        is_error: false,
                    },
                    Err(e) => ToolResult {
                        content: e.to_string(),
                        is_error: true,
                    },
                }
            }
            ExecutionContext::Fork => {
                let spawner = match self.spawner.as_ref() {
                    Some(s) => s.as_ref(),
                    None => {
                        return ToolResult {
                            content: format!(
                                "Skill '{}' requires fork execution context, \
                                 but no AgentSpawner is available. \
                                 Fork support is enabled via SkillTool::with_spawner().",
                                skill.name
                            ),
                            is_error: true,
                        };
                    }
                };
                match execute_fork(skill, args, self.session_id.as_deref(), &self.cwd, spawner)
                    .await
                {
                    Ok(content) => ToolResult {
                        content,
                        is_error: false,
                    },
                    Err(e) => ToolResult {
                        content: e,
                        is_error: true,
                    },
                }
            }
        }
    }

    fn context_modifier_for(&self, input: &serde_json::Value) -> Option<ContextModifier> {
        let skill_name = input["skill"].as_str()?;
        let skill = self.find_skill(skill_name)?;
        // Fork skills run in their own sub-agent context; modifiers must not
        // propagate back to the parent conversation.
        if skill.execution_context == ExecutionContext::Fork {
            return None;
        }
        flock_skills::context_modifier::from_skill_metadata(skill)
    }

    fn skill_hooks_for(&self, input: &serde_json::Value) -> Option<HooksConfig> {
        let skill_name = input["skill"].as_str()?;
        let skill = self.find_skill(skill_name)?;
        let config = parse_skill_hooks(skill.hooks_raw.as_ref(), &skill.name, skill.source)?;
        Some(to_hook_defs(&config, &skill.name))
    }

    fn category(&self) -> ToolCategory {
        // Inline mode returns skill content for the model to act on — categorised
        // as Info since it does not directly modify files or run commands.
        ToolCategory::Info
    }

    fn describe(&self, input: &Value) -> String {
        let name = input.get("skill").and_then(|v| v.as_str()).unwrap_or("?");
        match input.get("args").and_then(|v| v.as_str()) {
            Some(args) if !args.is_empty() => format!("Skill {name} {args}"),
            _ => format!("Skill {name}"),
        }
    }
}

