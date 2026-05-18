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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::SkillSource;
    use serde_json::json;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn make_cmd(
        command: &str,
        matcher: Option<&str>,
        timeout_secs: Option<u64>,
    ) -> SkillHookCommand {
        SkillHookCommand {
            command: command.to_string(),
            matcher: matcher.map(|s| s.to_string()),
            timeout_secs,
        }
    }

    // -----------------------------------------------------------------------
    // TC-11.1: full three-event hooks parse correctly
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_1_full_three_event_parse() {
        let raw = json!({
            "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo pre", "timeout": 10}]}],
            "PostToolUse": [{"matcher": "Read", "hooks": [{"type": "command", "command": "echo post"}]}],
            "Stop": [{"hooks": [{"type": "command", "command": "echo stop"}]}]
        });
        let result = parse_skill_hooks(Some(&raw), "my-skill", SkillSource::User);
        let config = result.expect("TC-11.1: should return Some");
        assert_eq!(config.pre_tool_use.len(), 1);
        assert_eq!(config.post_tool_use.len(), 1);
        assert_eq!(config.stop.len(), 1);
    }

    // -----------------------------------------------------------------------
    // TC-11.2: hooks_raw None returns None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_2_none_hooks_raw_returns_none() {
        let result = parse_skill_hooks(None, "my-skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.2: None input must return None");
    }

    // -----------------------------------------------------------------------
    // TC-11.3: MCP source returns None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_3_mcp_source_returns_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command", "command": "echo x"}]}]});
        let result = parse_skill_hooks(Some(&raw), "mcp-skill", SkillSource::Mcp);
        assert!(result.is_none(), "TC-11.3: MCP source must return None");
    }

    // -----------------------------------------------------------------------
    // TC-11.4: prompt type silently skipped → all vecs empty → None (AC-15)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_4_prompt_type_skipped_returns_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "prompt", "command": "echo x"}]}]});
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.4: prompt type only → None");
    }

    // -----------------------------------------------------------------------
    // TC-11.5: http type silently skipped → None (AC-15)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_5_http_type_skipped_returns_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "http", "url": "http://x"}]}]});
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.5: http type only → None");
    }

    // -----------------------------------------------------------------------
    // TC-11.6: agent type silently skipped → None (AC-15)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_6_agent_type_skipped_returns_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "agent", "agent": "foo"}]}]});
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.6: agent type only → None");
    }

    // -----------------------------------------------------------------------
    // TC-11.7: unknown event SessionStart silently skipped → all vecs empty → None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_7_unknown_event_skipped_returns_none() {
        let raw = json!({"SessionStart": [{"hooks": [{"type": "command", "command": "echo x"}]}]});
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.7: unknown event only → None");
    }

    // -----------------------------------------------------------------------
    // TC-11.8: mixed known/unknown events — known event parsed correctly
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_8_mixed_known_unknown_events() {
        let raw = json!({
            "PreToolUse": [{"hooks": [{"type": "command", "command": "echo pre"}]}],
            "SessionStart": [{"hooks": [{"type": "command", "command": "echo x"}]}]
        });
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        let config = result.expect("TC-11.8: known event present → Some");
        assert_eq!(config.pre_tool_use.len(), 1);
        assert_eq!(config.stop.len(), 0);
    }

    // -----------------------------------------------------------------------
    // TC-11.9: command entry missing command field → skipped → None (AC-15)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_9_missing_command_field_returns_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command"}]}]});
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.9: missing command field → None");
    }

    // -----------------------------------------------------------------------
    // TC-11.10: hooks_raw is array (not object) → None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_10_array_input_returns_none() {
        let raw = json!([1, 2, 3]);
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.10: array input must return None");
    }

    // -----------------------------------------------------------------------
    // TC-11.11: hooks_raw is null JSON → None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_11_null_json_returns_none() {
        let raw = json!(null);
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.11: null JSON must return None");
    }

    // -----------------------------------------------------------------------
    // TC-11.12: matcher field absent → None (match all tools)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_12_absent_matcher_is_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command", "command": "echo x"}]}]});
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.12: should return Some");
        assert!(
            config.pre_tool_use[0].matcher.is_none(),
            "TC-11.12: absent matcher should be None"
        );
    }

    // -----------------------------------------------------------------------
    // TC-11.13: matcher field present → preserved
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_13_present_matcher_preserved() {
        let raw = json!({"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo x"}]}]});
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.13: should return Some");
        assert_eq!(config.pre_tool_use[0].matcher.as_deref(), Some("Bash"));
    }

    // -----------------------------------------------------------------------
    // TC-11.14: timeout field present → preserved in seconds
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_14_timeout_preserved() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command", "command": "echo x", "timeout": 5}]}]});
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.14: should return Some");
        assert_eq!(config.pre_tool_use[0].timeout_secs, Some(5));
    }

    // -----------------------------------------------------------------------
    // TC-11.15: timeout field absent → None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_15_absent_timeout_is_none() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command", "command": "echo x"}]}]});
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.15: should return Some");
        assert!(config.pre_tool_use[0].timeout_secs.is_none());
    }

    // -----------------------------------------------------------------------
    // TC-11.16: Project/Managed/Bundled/Legacy sources all parse successfully
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_16_non_mcp_sources_parse_successfully() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command", "command": "echo x"}]}]});
        for source in [
            SkillSource::Project,
            SkillSource::Managed,
            SkillSource::Bundled,
            SkillSource::Legacy,
        ] {
            let result = parse_skill_hooks(Some(&raw), "skill", source);
            assert!(
                result.is_some(),
                "TC-11.16: source {:?} should return Some",
                source
            );
        }
    }

    // -----------------------------------------------------------------------
    // TC-11.17: mixed command + prompt in same matcher → only command kept
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_17_mixed_command_and_prompt_keeps_command_only() {
        let raw = json!({
            "PreToolUse": [{"hooks": [
                {"type": "command", "command": "echo x"},
                {"type": "prompt", "prompt": "p"}
            ]}]
        });
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.17: command present → Some");
        assert_eq!(config.pre_tool_use.len(), 1);
        assert_eq!(config.pre_tool_use[0].command, "echo x");
    }

    // -----------------------------------------------------------------------
    // TC-11.18: empty hooks object {} → None (AC-15)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_18_empty_object_returns_none() {
        let raw = json!({});
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.18: empty object → None");
    }

    // -----------------------------------------------------------------------
    // TC-11.19: AC-15 mixed scenario: pre has command, post has prompt only → Some
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_19_pre_command_post_prompt_returns_some() {
        let raw = json!({
            "PreToolUse": [{"hooks": [{"type": "command", "command": "echo pre"}]}],
            "PostToolUse": [{"hooks": [{"type": "prompt", "prompt": "p"}]}]
        });
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.19: pre has command → Some");
        assert_eq!(config.pre_tool_use.len(), 1);
        assert_eq!(config.post_tool_use.len(), 0);
    }

    // -----------------------------------------------------------------------
    // TC-11.20: pre_tool_use hook correctly converted to HookDef
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_20_pre_hook_converted_to_hookdef() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![make_cmd("echo x", Some("Bash"), Some(5))],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "my-skill");
        assert_eq!(result.pre_tool_use.len(), 1);
        let def = &result.pre_tool_use[0];
        assert!(
            def.name.contains("my-skill"),
            "TC-11.20: name must contain skill name"
        );
        assert_eq!(def.command, "echo x");
        assert_eq!(def.tool_match, vec!["Bash"]);
        assert_eq!(def.timeout_ms, 5_000);
    }

    // -----------------------------------------------------------------------
    // TC-11.21: post_tool_use hook — no matcher → empty tool_match, default timeout
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_21_post_hook_no_matcher_default_timeout() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![],
            post_tool_use: vec![make_cmd("echo y", None, None)],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "my-skill");
        let def = &result.post_tool_use[0];
        assert!(
            def.tool_match.is_empty(),
            "TC-11.21: None matcher → empty tool_match"
        );
        assert_eq!(
            def.timeout_ms, 30_000,
            "TC-11.21: absent timeout → 30s default"
        );
    }

    // -----------------------------------------------------------------------
    // TC-11.22: stop hook converted with skill name prefix
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_22_stop_hook_name_has_prefix() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![],
            post_tool_use: vec![],
            stop: vec![make_cmd("echo z", None, None)],
        };
        let result = to_hook_defs(&config, "my-stopper");
        assert_eq!(result.stop.len(), 1);
        assert!(
            result.stop[0].name.starts_with("skill:my-stopper:"),
            "TC-11.22: stop hook name must start with 'skill:my-stopper:', got: {}",
            result.stop[0].name
        );
    }

    // -----------------------------------------------------------------------
    // TC-11.23: hook name includes skill name as prefix
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_23_hook_name_starts_with_skill_name() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![make_cmd("echo", None, None)],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "linter");
        assert!(
            result.pre_tool_use[0].name.starts_with("skill:linter"),
            "TC-11.23: name must start with 'skill:linter', got: {}",
            result.pre_tool_use[0].name
        );
    }

    // -----------------------------------------------------------------------
    // TC-11.24: timeout seconds converted to milliseconds (×1000)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_24_timeout_secs_to_ms() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![make_cmd("echo", None, Some(10))],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "skill");
        assert_eq!(result.pre_tool_use[0].timeout_ms, 10_000);
    }

    // -----------------------------------------------------------------------
    // TC-11.25: timeout = 0 seconds → 0 ms (boundary)
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_25_timeout_zero_secs() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![make_cmd("echo", None, Some(0))],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "skill");
        assert_eq!(result.pre_tool_use[0].timeout_ms, 0);
    }

    // -----------------------------------------------------------------------
    // TC-11.26: empty SkillHooksConfig → all vecs empty in result
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_26_empty_config_produces_empty_hooksdconfig() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "skill");
        assert!(result.pre_tool_use.is_empty());
        assert!(result.post_tool_use.is_empty());
        assert!(result.stop.is_empty());
    }

    // -----------------------------------------------------------------------
    // TC-11.27: multiple pre hooks — all converted
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_27_multiple_pre_hooks_all_converted() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![
                make_cmd("echo 1", None, None),
                make_cmd("echo 2", None, None),
                make_cmd("echo 3", None, None),
            ],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "skill");
        assert_eq!(result.pre_tool_use.len(), 3);
    }

    // -----------------------------------------------------------------------
    // TC-11.50: all three events with multiple matchers each
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_50_all_three_events_multiple_matchers() {
        let raw = json!({
            "PreToolUse": [
                {"hooks": [{"type": "command", "command": "echo pre-1"}]},
                {"hooks": [{"type": "command", "command": "echo pre-2"}]}
            ],
            "PostToolUse": [
                {"hooks": [{"type": "command", "command": "echo post-1"}]},
                {"hooks": [{"type": "command", "command": "echo post-2"}]}
            ],
            "Stop": [
                {"hooks": [{"type": "command", "command": "echo stop-1"}]},
                {"hooks": [{"type": "command", "command": "echo stop-2"}]}
            ]
        });
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.50: should return Some");
        assert_eq!(config.pre_tool_use.len(), 2);
        assert_eq!(config.post_tool_use.len(), 2);
        assert_eq!(config.stop.len(), 2);
    }

    // -----------------------------------------------------------------------
    // TC-11.51: empty skill_name in to_hook_defs — no panic
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_51_empty_skill_name_no_panic() {
        let config = SkillHooksConfig {
            pre_tool_use: vec![make_cmd("echo", None, None)],
            post_tool_use: vec![],
            stop: vec![],
        };
        let result = to_hook_defs(&config, "");
        assert_eq!(
            result.pre_tool_use.len(),
            1,
            "TC-11.51: should produce 1 HookDef without panic"
        );
    }

    // -----------------------------------------------------------------------
    // TC-11.52: command field is empty string — parse succeeds
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_52_empty_command_string_succeeds() {
        let raw = json!({"PreToolUse": [{"hooks": [{"type": "command", "command": ""}]}]});
        let config = parse_skill_hooks(Some(&raw), "skill", SkillSource::User)
            .expect("TC-11.52: empty command string should still parse");
        assert_eq!(config.pre_tool_use[0].command, "");
    }

    // -----------------------------------------------------------------------
    // TC-11.53: very large timeout — saturating_mul prevents overflow
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_53_large_timeout_no_overflow() {
        let large_secs = u64::MAX / 1_000;
        let config = SkillHooksConfig {
            pre_tool_use: vec![make_cmd("echo", None, Some(large_secs))],
            post_tool_use: vec![],
            stop: vec![],
        };
        // saturating_mul: (u64::MAX / 1000) * 1000 should not overflow
        let result = to_hook_defs(&config, "skill");
        assert!(
            result.pre_tool_use[0].timeout_ms > 0,
            "TC-11.53: large timeout must not overflow to 0"
        );
    }

    // -----------------------------------------------------------------------
    // TC-11.54: hooks_raw is a string (not object) → None
    // -----------------------------------------------------------------------
    #[test]
    fn tc_11_54_string_input_returns_none() {
        let raw = json!("not an object");
        let result = parse_skill_hooks(Some(&raw), "skill", SkillSource::User);
        assert!(result.is_none(), "TC-11.54: string input must return None");
    }
}
