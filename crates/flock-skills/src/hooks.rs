use crate::types::SkillSource;
use flock_core::config::hooks::{HookDef, HooksConfig};

/// A single hook command extracted from skill frontmatter.
/// Only command-type hooks are supported; prompt/http/agent are silently skipped.
pub struct SkillHookCommand {
    pub command: String,
    /// Tool name glob pattern; None means match all tools.
    pub matcher: Option<String>,
    /// Timeout in seconds (converted to ms when building HookDef).
    pub timeout_secs: Option<u64>,
}

/// Parsed hooks from a skill's frontmatter, grouped by event.
pub struct SkillHooksConfig {
    pub pre_tool_use: Vec<SkillHookCommand>,
    pub post_tool_use: Vec<SkillHookCommand>,
    pub stop: Vec<SkillHookCommand>,
}

/// Parse `hooks_raw` (serde_json::Value) into a `SkillHooksConfig`.
///
/// Returns None when:
/// - `hooks_raw` is None
/// - skill source is MCP (security boundary)
/// - the JSON is not an object (logs warning)
/// - after parsing all events, every vec is empty (D-5)
pub fn parse_skill_hooks(
    hooks_raw: Option<&serde_json::Value>,
    skill_name: &str,
    source: SkillSource,
) -> Option<SkillHooksConfig> {
    // MCP skills may not register hooks (security boundary).
    if source == SkillSource::Mcp {
        eprintln!("[skill:{skill_name}] MCP source — hooks ignored");
        return None;
    }

    let raw = hooks_raw?;

    let obj = match raw.as_object() {
        Some(o) => o,
        None => {
            eprintln!("[skill:{skill_name}] hooks_raw is not a JSON object, ignoring");
            return None;
        }
    };

    let mut config = SkillHooksConfig {
        pre_tool_use: Vec::new(),
        post_tool_use: Vec::new(),
        stop: Vec::new(),
    };

    for (event_key, matchers_val) in obj {
        let target = match event_key.as_str() {
            "PreToolUse" => &mut config.pre_tool_use,
            "PostToolUse" => &mut config.post_tool_use,
            "Stop" => &mut config.stop,
            other => {
                eprintln!("[skill:{skill_name}] unknown hook event '{other}', skipping");
                continue;
            }
        };

        let matchers = match matchers_val.as_array() {
            Some(a) => a,
            None => {
                eprintln!(
                    "[skill:{skill_name}] hook event '{}' value is not an array, skipping",
                    event_key
                );
                continue;
            }
        };

        for matcher_entry in matchers {
            let matcher_str = matcher_entry["matcher"].as_str().map(|s| s.to_string());

            let hooks_arr = match matcher_entry["hooks"].as_array() {
                Some(a) => a,
                None => continue,
            };

            for hook in hooks_arr {
                // Only command-type hooks are supported.
                match hook["type"].as_str() {
                    Some("command") => {}
                    Some(other) => {
                        eprintln!("[skill:{skill_name}] unsupported hook type '{other}', skipping");
                        continue;
                    }
                    None => {
                        eprintln!("[skill:{skill_name}] hook missing type field, skipping");
                        continue;
                    }
                }

                let command = match hook["command"].as_str() {
                    Some(c) => c.to_string(),
                    None => {
                        eprintln!(
                            "[skill:{skill_name}] command-type hook missing command field, skipping"
                        );
                        continue;
                    }
                };

                let timeout_secs = hook["timeout"].as_u64();

                target.push(SkillHookCommand {
                    command,
                    matcher: matcher_str.clone(),
                    timeout_secs,
                });
            }
        }
    }

    // D-5: return None when all vecs are empty after parsing.
    if config.pre_tool_use.is_empty() && config.post_tool_use.is_empty() && config.stop.is_empty() {
        return None;
    }

    Some(config)
}

/// Convert a `SkillHooksConfig` into a `HooksConfig` (Vec<HookDef> per event).
///
/// Hook name format: `skill:{skill_name}:{event}:{index}` for idempotent merging.
pub fn to_hook_defs(config: &SkillHooksConfig, skill_name: &str) -> HooksConfig {
    HooksConfig {
        pre_tool_use: build_defs(&config.pre_tool_use, skill_name, "pre_tool_use"),
        post_tool_use: build_defs(&config.post_tool_use, skill_name, "post_tool_use"),
        stop: build_defs(&config.stop, skill_name, "stop"),
    }
}

fn build_defs(cmds: &[SkillHookCommand], skill_name: &str, event: &str) -> Vec<HookDef> {
    cmds.iter()
        .enumerate()
        .map(|(idx, cmd)| {
            let tool_match = cmd
                .matcher
                .as_deref()
                .map(|m| vec![m.to_string()])
                .unwrap_or_default();

            let timeout_ms = cmd
                .timeout_secs
                .map(|s| s.saturating_mul(1_000))
                .unwrap_or(30_000);

            HookDef {
                name: format!("skill:{}:{}:{}", skill_name, event, idx),
                tool_match,
                file_match: Vec::new(),
                command: cmd.command.clone(),
                timeout_ms,
            }
        })
        .collect()
}



