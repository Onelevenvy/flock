//! Microcompact: clear old tool result content without any LLM call.
//!
//! This is the lightest compaction level.  It walks the conversation,
//! identifies tool results from compactable tools, and replaces the
//! content of all but the N most recent with a short placeholder.

use std::collections::{HashMap, HashSet};

use chrono::Utc;
use flock_core::config::compression::CompressionConfig;
use flock_core::types::message::{ContentBlock, Message, Role};

/// Placeholder that replaces cleared tool result content.
pub const CLEARED_TOOL_RESULT: &str = "[Tool result cleared]";

/// Statistics returned after a microcompact pass.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MicrocompactResult {
    /// Number of tool results whose content was cleared.
    pub cleared_count: usize,
    /// Rough estimate of tokens freed (content bytes / 4).
    pub estimated_tokens_freed: usize,
}

// ── Trigger checks ──────────────────────────────────────────────────────────

/// Decide whether microcompact should run.
///
/// Returns `true` if **either** trigger fires:
/// - **Time**: the most recent assistant message is older than
///   `config.micro_gap_seconds`.
/// - **Count**: total compactable (non-cleared) tool results exceed
///   `config.micro_keep_recent * 2`.
pub fn should_microcompact(messages: &[Message], config: &CompressionConfig) -> bool {
    if !config.enabled {
        return false;
    }
    time_trigger(messages, config) || count_trigger(messages, config)
}

/// Time-based trigger: last assistant timestamp older than gap threshold.
fn time_trigger(messages: &[Message], config: &CompressionConfig) -> bool {
    let last_assistant_ts = messages
        .iter()
        .rev()
        .filter(|m| m.role == Role::Assistant)
        .find_map(|m| m.timestamp);

    let Some(ts) = last_assistant_ts else {
        return false;
    };

    let gap = Utc::now().signed_duration_since(ts);
    gap.num_seconds() >= config.micro_gap_seconds as i64
}

/// Count-based trigger: compactable tool results > keep_recent * 2.
fn count_trigger(messages: &[Message], config: &CompressionConfig) -> bool {
    let tool_names = build_tool_name_map(messages);
    let compactable_set: HashSet<&str> = config
        .compactable_tools
        .iter()
        .map(String::as_str)
        .collect();

    let count = count_compactable_results(messages, &tool_names, &compactable_set);
    count > config.micro_keep_recent * 2
}

// ── Core compaction ─────────────────────────────────────────────────────────

/// Clear old tool result content in-place.
///
/// Keeps the `config.micro_keep_recent` most recent compactable results
/// (minimum 1) and replaces older ones with [`CLEARED_TOOL_RESULT`].
/// Already-cleared results are left untouched and do not count toward
/// the keep budget.
pub fn microcompact(messages: &mut [Message], config: &CompressionConfig) -> MicrocompactResult {
    let tool_names = build_tool_name_map(messages);
    let compactable_set: HashSet<&str> = config
        .compactable_tools
        .iter()
        .map(String::as_str)
        .collect();

    // Collect (message_index, block_index) of all compactable, non-cleared
    // tool results, in conversation order.
    let targets = collect_compactable_locations(messages, &tool_names, &compactable_set);

    let keep = config.micro_keep_recent.max(1);
    if targets.len() <= keep {
        return MicrocompactResult {
            cleared_count: 0,
            estimated_tokens_freed: 0,
        };
    }

    let to_clear = &targets[..targets.len() - keep];

    let mut cleared_count = 0usize;
    let mut tokens_freed = 0usize;

    for &(mi, bi) in to_clear {
        if let ContentBlock::ToolResult { content, .. } = &mut messages[mi].content[bi] {
            // Rough token estimate: ~4 chars per token.
            tokens_freed += content.len() / 4;
            *content = CLEARED_TOOL_RESULT.to_string();
            cleared_count += 1;
        }
    }

    MicrocompactResult {
        cleared_count,
        estimated_tokens_freed: tokens_freed,
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Build a map from tool_use_id → tool name by scanning ToolUse blocks
/// across all messages.
fn build_tool_name_map(messages: &[Message]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for msg in messages {
        for block in &msg.content {
            if let ContentBlock::ToolUse { id, name, .. } = block {
                map.insert(id.clone(), name.clone());
            }
        }
    }
    map
}

/// Count compactable, non-cleared tool results.
fn count_compactable_results(
    messages: &[Message],
    tool_names: &HashMap<String, String>,
    compactable_set: &HashSet<&str>,
) -> usize {
    messages
        .iter()
        .flat_map(|m| &m.content)
        .filter(|b| is_compactable_and_live(b, tool_names, compactable_set))
        .count()
}

/// Collect `(message_index, block_index)` of every compactable, non-cleared
/// tool result in conversation order.
fn collect_compactable_locations(
    messages: &[Message],
    tool_names: &HashMap<String, String>,
    compactable_set: &HashSet<&str>,
) -> Vec<(usize, usize)> {
    let mut locations = Vec::new();
    for (mi, msg) in messages.iter().enumerate() {
        for (bi, block) in msg.content.iter().enumerate() {
            if is_compactable_and_live(block, tool_names, compactable_set) {
                locations.push((mi, bi));
            }
        }
    }
    locations
}

/// A tool result is "compactable and live" when:
/// 1. It is a `ToolResult` variant.
/// 2. Its corresponding tool name is in the compactable set.
/// 3. Its content has not already been cleared.
fn is_compactable_and_live(
    block: &ContentBlock,
    tool_names: &HashMap<String, String>,
    compactable_set: &HashSet<&str>,
) -> bool {
    if let ContentBlock::ToolResult {
        tool_use_id,
        content,
        ..
    } = block
    {
        if content == CLEARED_TOOL_RESULT {
            return false;
        }
        if let Some(name) = tool_names.get(tool_use_id) {
            return compactable_set.contains(name.as_str());
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    use serde_json::json;

    // ── Test helpers ────────────────────────────────────────────────────

    fn tool_use_block(id: &str, name: &str) -> ContentBlock {
        ContentBlock::ToolUse {
            id: id.to_string(),
            name: name.to_string(),
            input: json!({}),
        }
    }

    fn tool_result_block(id: &str, content: &str) -> ContentBlock {
        ContentBlock::ToolResult {
            tool_use_id: id.to_string(),
            content: content.to_string(),
            is_error: false,
        }
    }

    fn text_block(text: &str) -> ContentBlock {
        ContentBlock::Text {
            text: text.to_string(),
        }
    }

    fn assistant_msg(blocks: Vec<ContentBlock>) -> Message {
        Message::new(Role::Assistant, blocks)
    }

    fn user_msg(blocks: Vec<ContentBlock>) -> Message {
        Message::new(Role::User, blocks)
    }

    fn assistant_msg_at(blocks: Vec<ContentBlock>, ts: chrono::DateTime<Utc>) -> Message {
        Message {
            role: Role::Assistant,
            content: blocks,
            timestamp: Some(ts),
        }
    }

    fn default_config() -> CompressionConfig {
        CompressionConfig::default()
    }

    // ── build_tool_name_map ─────────────────────────────────────────────

    #[test]
    fn tool_name_map_from_single_assistant() {
        let msgs = vec![assistant_msg(vec![
            tool_use_block("t1", "Read"),
            tool_use_block("t2", "Bash"),
        ])];
        let map = build_tool_name_map(&msgs);
        assert_eq!(map.get("t1").unwrap(), "Read");
        assert_eq!(map.get("t2").unwrap(), "Bash");
    }

    #[test]
    fn tool_name_map_ignores_non_tool_use() {
        let msgs = vec![
            user_msg(vec![text_block("hello")]),
            user_msg(vec![tool_result_block("t1", "output")]),
        ];
        let map = build_tool_name_map(&msgs);
        assert!(map.is_empty());
    }

    // ── is_compactable_and_live ─────────────────────────────────────────

    #[test]
    fn live_compactable_result_returns_true() {
        let tool_names: HashMap<String, String> =
            [("t1".into(), "Read".into())].into_iter().collect();
        let set: HashSet<&str> = ["Read"].into_iter().collect();
        let block = tool_result_block("t1", "file content here");
        assert!(is_compactable_and_live(&block, &tool_names, &set));
    }

    #[test]
    fn already_cleared_result_returns_false() {
        let tool_names: HashMap<String, String> =
            [("t1".into(), "Read".into())].into_iter().collect();
        let set: HashSet<&str> = ["Read"].into_iter().collect();
        let block = tool_result_block("t1", CLEARED_TOOL_RESULT);
        assert!(!is_compactable_and_live(&block, &tool_names, &set));
    }

    #[test]
    fn non_compactable_tool_returns_false() {
        let tool_names: HashMap<String, String> =
            [("t1".into(), "Skill".into())].into_iter().collect();
        let set: HashSet<&str> = ["Read", "Bash"].into_iter().collect();
        let block = tool_result_block("t1", "result");
        assert!(!is_compactable_and_live(&block, &tool_names, &set));
    }

    #[test]
    fn text_block_returns_false() {
        let tool_names = HashMap::new();
        let set: HashSet<&str> = ["Read"].into_iter().collect();
        let block = text_block("hello");
        assert!(!is_compactable_and_live(&block, &tool_names, &set));
    }

    #[test]
    fn unknown_tool_use_id_returns_false() {
        let tool_names = HashMap::new(); // no ToolUse registered
        let set: HashSet<&str> = ["Read"].into_iter().collect();
        let block = tool_result_block("orphan", "data");
        assert!(!is_compactable_and_live(&block, &tool_names, &set));
    }

    // ── time_trigger ────────────────────────────────────────────────────

    #[test]
    fn time_trigger_fires_when_gap_exceeded() {
        let old_ts = Utc::now() - Duration::seconds(3700);
        let msgs = vec![assistant_msg_at(vec![text_block("hi")], old_ts)];
        let config = CompressionConfig {
            micro_gap_seconds: 3600,
            ..default_config()
        };
        assert!(time_trigger(&msgs, &config));
    }

    #[test]
    fn time_trigger_silent_when_within_gap() {
        let recent_ts = Utc::now() - Duration::seconds(1800);
        let msgs = vec![assistant_msg_at(vec![text_block("hi")], recent_ts)];
        let config = CompressionConfig {
            micro_gap_seconds: 3600,
            ..default_config()
        };
        assert!(!time_trigger(&msgs, &config));
    }

    #[test]
    fn time_trigger_silent_when_no_timestamp() {
        let msgs = vec![assistant_msg(vec![text_block("hi")])];
        let config = default_config();
        assert!(!time_trigger(&msgs, &config));
    }

    #[test]
    fn time_trigger_uses_latest_assistant() {
        let old_ts = Utc::now() - Duration::seconds(7200);
        let recent_ts = Utc::now() - Duration::seconds(100);
        let msgs = vec![
            assistant_msg_at(vec![text_block("first")], old_ts),
            assistant_msg_at(vec![text_block("second")], recent_ts),
        ];
        let config = CompressionConfig {
            micro_gap_seconds: 3600,
            ..default_config()
        };
        // The most recent assistant (100s ago) is within the gap.
        assert!(!time_trigger(&msgs, &config));
    }

    // ── count_trigger ───────────────────────────────────────────────────

    #[test]
    fn count_trigger_fires_above_threshold() {
        // keep_recent=3, threshold=6.  Create 7 compactable results.
        let mut msgs = Vec::new();
        for i in 0..7 {
            let id = format!("t{i}");
            msgs.push(assistant_msg(vec![tool_use_block(&id, "Read")]));
            msgs.push(user_msg(vec![tool_result_block(&id, "data")]));
        }
        let config = CompressionConfig {
            micro_keep_recent: 3,
            ..default_config()
        };
        assert!(count_trigger(&msgs, &config));
    }

    #[test]
    fn count_trigger_silent_at_threshold() {
        // keep_recent=3, threshold=6.  Create exactly 6 results.
        let mut msgs = Vec::new();
        for i in 0..6 {
            let id = format!("t{i}");
            msgs.push(assistant_msg(vec![tool_use_block(&id, "Read")]));
            msgs.push(user_msg(vec![tool_result_block(&id, "data")]));
        }
        let config = CompressionConfig {
            micro_keep_recent: 3,
            ..default_config()
        };
        assert!(!count_trigger(&msgs, &config));
    }

    // ── microcompact ────────────────────────────────────────────────────

    #[test]
    fn clears_oldest_keeps_recent() {
        // 5 tool results, keep_recent=2  →  clear 3.
        let mut msgs = Vec::new();
        for i in 0..5 {
            let id = format!("t{i}");
            msgs.push(assistant_msg(vec![tool_use_block(&id, "Read")]));
            msgs.push(user_msg(vec![tool_result_block(&id, &format!("data-{i}"))]));
        }
        let config = CompressionConfig {
            micro_keep_recent: 2,
            ..default_config()
        };

        let result = microcompact(&mut msgs, &config);
        assert_eq!(result.cleared_count, 3);
        assert!(result.estimated_tokens_freed > 0);

        // First 3 user msgs (indices 1,3,5) should be cleared.
        for idx in [1, 3, 5] {
            let content = match &msgs[idx].content[0] {
                ContentBlock::ToolResult { content, .. } => content.as_str(),
                _ => panic!("expected ToolResult"),
            };
            assert_eq!(content, CLEARED_TOOL_RESULT);
        }
        // Last 2 user msgs (indices 7,9) should retain original content.
        for (idx, expected) in [(7, "data-3"), (9, "data-4")] {
            let content = match &msgs[idx].content[0] {
                ContentBlock::ToolResult { content, .. } => content.as_str(),
                _ => panic!("expected ToolResult"),
            };
            assert_eq!(content, expected);
        }
    }

    #[test]
    fn no_clear_when_below_keep_recent() {
        let mut msgs = vec![
            assistant_msg(vec![tool_use_block("t1", "Read")]),
            user_msg(vec![tool_result_block("t1", "data")]),
        ];
        let config = CompressionConfig {
            micro_keep_recent: 5,
            ..default_config()
        };
        let result = microcompact(&mut msgs, &config);
        assert_eq!(result.cleared_count, 0);
        assert_eq!(result.estimated_tokens_freed, 0);
    }

    #[test]
    fn skips_non_compactable_tools() {
        let mut msgs = vec![
            assistant_msg(vec![tool_use_block("t1", "Read")]),
            user_msg(vec![tool_result_block("t1", "file-data")]),
            assistant_msg(vec![tool_use_block("t2", "Skill")]),
            user_msg(vec![tool_result_block("t2", "skill-output")]),
            assistant_msg(vec![tool_use_block("t3", "Bash")]),
            user_msg(vec![tool_result_block("t3", "bash-output")]),
        ];
        // compactable_tools does NOT include Skill.
        let config = CompressionConfig {
            micro_keep_recent: 1,
            compactable_tools: vec!["Read".into(), "Bash".into()],
            ..default_config()
        };

        let result = microcompact(&mut msgs, &config);
        // Only Read(t1) should be cleared; Bash(t3) kept as most recent.
        assert_eq!(result.cleared_count, 1);

        // Skill result untouched.
        match &msgs[3].content[0] {
            ContentBlock::ToolResult { content, .. } => {
                assert_eq!(content, "skill-output");
            }
            _ => panic!("expected ToolResult"),
        }
    }

    #[test]
    fn does_not_recleared_already_cleared() {
        let mut msgs = vec![
            assistant_msg(vec![tool_use_block("t1", "Read")]),
            user_msg(vec![tool_result_block("t1", CLEARED_TOOL_RESULT)]),
            assistant_msg(vec![tool_use_block("t2", "Read")]),
            user_msg(vec![tool_result_block("t2", "live-data")]),
        ];
        let config = CompressionConfig {
            micro_keep_recent: 1,
            ..default_config()
        };
        let result = microcompact(&mut msgs, &config);
        // t1 already cleared → not in compactable list.
        // Only t2 is compactable, and it's the most recent → keep it.
        assert_eq!(result.cleared_count, 0);
    }

    #[test]
    fn empty_messages_returns_zero() {
        let mut msgs: Vec<Message> = Vec::new();
        let result = microcompact(&mut msgs, &default_config());
        assert_eq!(result.cleared_count, 0);
        assert_eq!(result.estimated_tokens_freed, 0);
    }

    #[test]
    fn message_count_and_order_preserved() {
        let mut msgs = vec![
            assistant_msg(vec![tool_use_block("t1", "Read")]),
            user_msg(vec![tool_result_block("t1", &"a".repeat(100))]),
            assistant_msg(vec![tool_use_block("t2", "Read")]),
            user_msg(vec![tool_result_block("t2", &"b".repeat(100))]),
            assistant_msg(vec![tool_use_block("t3", "Read")]),
            user_msg(vec![tool_result_block("t3", &"c".repeat(100))]),
        ];
        let original_len = msgs.len();
        let config = CompressionConfig {
            micro_keep_recent: 1,
            ..default_config()
        };
        microcompact(&mut msgs, &config);

        assert_eq!(msgs.len(), original_len);
        // Roles alternate: Assistant, User, Assistant, User, ...
        for (i, msg) in msgs.iter().enumerate() {
            let expected = if i % 2 == 0 {
                Role::Assistant
            } else {
                Role::User
            };
            assert_eq!(msg.role, expected);
        }
    }

    #[test]
    fn token_estimate_proportional_to_content() {
        let long_content = "x".repeat(400); // ~100 tokens
        let mut msgs = vec![
            assistant_msg(vec![tool_use_block("t1", "Read")]),
            user_msg(vec![tool_result_block("t1", &long_content)]),
            assistant_msg(vec![tool_use_block("t2", "Read")]),
            user_msg(vec![tool_result_block("t2", "keep")]),
        ];
        let config = CompressionConfig {
            micro_keep_recent: 1,
            ..default_config()
        };
        let result = microcompact(&mut msgs, &config);
        assert_eq!(result.cleared_count, 1);
        assert_eq!(result.estimated_tokens_freed, 100); // 400 / 4
    }

    // ── should_microcompact ─────────────────────────────────────────────

    #[test]
    fn should_returns_false_when_disabled() {
        let old_ts = Utc::now() - Duration::seconds(7200);
        let msgs = vec![assistant_msg_at(vec![text_block("hi")], old_ts)];
        let config = CompressionConfig {
            enabled: false,
            micro_gap_seconds: 3600,
            ..default_config()
        };
        assert!(!should_microcompact(&msgs, &config));
    }

    #[test]
    fn keep_recent_floored_at_one() {
        // Even with keep_recent=0, we never clear everything.
        let mut msgs = vec![
            assistant_msg(vec![tool_use_block("t1", "Read")]),
            user_msg(vec![tool_result_block("t1", "data-1")]),
            assistant_msg(vec![tool_use_block("t2", "Read")]),
            user_msg(vec![tool_result_block("t2", "data-2")]),
        ];
        let config = CompressionConfig {
            micro_keep_recent: 0,
            ..default_config()
        };
        let result = microcompact(&mut msgs, &config);
        // 2 compactable, keep at least 1 → clear 1.
        assert_eq!(result.cleared_count, 1);
        // The most recent (t2) must survive.
        match &msgs[3].content[0] {
            ContentBlock::ToolResult { content, .. } => {
                assert_eq!(content, "data-2");
            }
            _ => panic!("expected ToolResult"),
        }
    }
}
