use std::sync::{Arc, Mutex};

use crate::approval::{ApprovalDecision, ToolApproval};
use flock_core::config::hooks::HookEngine;
use flock_core::ipc_interface::approval::{ToolApprovalManager, ToolApprovalResult};
use flock_core::ipc_interface::events::{OutputType, ProtocolEvent, ToolCategory, ToolInfo, ToolStatus};
use flock_core::ipc_interface::writer::ProtocolEmitter;
use flock_core::types::message::ContentBlock;
use flock_core::types::skill_types::ContextModifier;
use flock_core::types::tool::ToolResult;

use flock_tools::registry::ToolRegistry;

/// The combined output of a tool execution batch: ipc_interface content blocks
/// paired with per-call context modifiers (None for non-skill tools).
pub struct ToolCallOutcome {
    pub results: Vec<ContentBlock>,
    pub modifiers: Vec<Option<ContextModifier>>,
}

impl std::ops::Deref for ToolCallOutcome {
    type Target = Vec<ContentBlock>;
    fn deref(&self) -> &Self::Target {
        &self.results
    }
}

impl std::ops::DerefMut for ToolCallOutcome {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.results
    }
}

/// Partition tool calls and execute them with optional confirmation and hooks
pub async fn run_tools(
    registry: &ToolRegistry,
    tool_calls: &[ContentBlock],
    confirmer: Option<&Arc<Mutex<ToolApproval>>>,
    mut hooks: Option<&mut HookEngine>,
    compaction_level: flock_core::context_compression::CompressionLevel,
    toon_enabled: bool,
) -> Result<ToolCallOutcome, ExecutionControl> {
    let mut results = Vec::new();
    let mut modifiers = Vec::new();

    for batch in group_calls(registry, tool_calls) {
        if batch.is_concurrent {
            // For concurrent batch, confirm all first, then execute approved ones.
            // Concurrent tools are never SkillTool (is_concurrency_safe=false for Skill),
            // so no skill hooks merging is needed here.
            let mut approved = Vec::new();
            for call in &batch.calls {
                match request_approval(confirmer, call)? {
                    Some(denied) => {
                        results.push(denied);
                        modifiers.push(None);
                    }
                    None => approved.push(call),
                }
            }
            // Reborrow as shared for concurrent execution.
            let hooks_shared: Option<&HookEngine> = hooks.as_deref();
            let futures: Vec<_> = approved
                .iter()
                .map(|call| {
                    execute_single(registry, call, hooks_shared, compaction_level, toon_enabled)
                })
                .collect();
            let batch_results = futures::future::join_all(futures).await;
            for (block, modifier) in batch_results {
                results.push(block);
                modifiers.push(modifier);
            }
        } else {
            for call in &batch.calls {
                match request_approval(confirmer, call)? {
                    Some(denied) => {
                        results.push(denied);
                        modifiers.push(None);
                    }
                    None => {
                        // Reborrow as shared for execute_single, then reclaim mut for merge.
                        let block;
                        let modifier;
                        {
                            let hooks_shared: Option<&HookEngine> = hooks.as_deref();
                            (block, modifier) = execute_single(
                                registry,
                                call,
                                hooks_shared,
                                compaction_level,
                                toon_enabled,
                            )
                            .await;
                        }
                        // Merge skill hooks after a successful sequential execution.
                        if !block_is_error(&block) {
                            update_plugin_hooks(registry, call, hooks.as_deref_mut());
                        }
                        results.push(block);
                        modifiers.push(modifier);
                    }
                }
            }
        }
    }

    Ok(ToolCallOutcome { results, modifiers })
}

/// Signal that the user wants to abort
#[derive(Debug)]
pub enum ExecutionControl {
    Quit,
}

/// Confirm a single tool call. Returns Ok(Some(result)) if denied, Ok(None) if approved, Err if quit.
fn request_approval(
    confirmer: Option<&Arc<Mutex<ToolApproval>>>,
    call: &ContentBlock,
) -> Result<Option<ContentBlock>, ExecutionControl> {
    let ContentBlock::ToolUse { id, name, input } = call else {
        return Ok(None);
    };

    let Some(confirmer) = confirmer else {
        return Ok(None);
    };

    let input_display = serde_json::to_string(input).unwrap_or_default();
    let result = confirmer
        .lock()
        .unwrap()
        .check(name, &truncate_display(&input_display, 200));

    match result {
        ApprovalDecision::Approved => Ok(None),
        ApprovalDecision::Denied => Ok(Some(ContentBlock::ToolResult {
            tool_use_id: id.clone(),
            content: "Tool execution denied by user".to_string(),
            is_error: true,
        })),
        ApprovalDecision::Quit => Err(ExecutionControl::Quit),
    }
}

async fn execute_single(
    registry: &ToolRegistry,
    call: &ContentBlock,
    hooks: Option<&HookEngine>,
    compaction_level: flock_core::context_compression::CompressionLevel,
    toon_enabled: bool,
) -> (ContentBlock, Option<ContextModifier>) {
    let ContentBlock::ToolUse { id, name, input } = call else {
        unreachable!("execute_single called with non-ToolUse block")
    };

    // Run pre-tool-use hooks
    if let Some(hook_engine) = hooks
        && let Err(e) = hook_engine.run_pre_tool_use(name, input).await
    {
        return (
            ContentBlock::ToolResult {
                tool_use_id: id.clone(),
                content: format!("Blocked by hook: {}", e),
                is_error: true,
            },
            None,
        );
    }

    let (result, modifier) = match registry.get(name) {
        Some(tool) => {
            let max_size = tool.max_result_size();
            let r = tool.execute(input.clone()).await;
            let modifier = if r.is_error {
                None
            } else {
                tool.context_modifier_for(input)
            };
            let error_content = if r.is_error && tool.is_deferred() {
                maybe_append_deferred_hint(&r.content, tool.input_schema(), input)
            } else {
                r.content.clone()
            };
            let content = truncate_result(&error_content, max_size);
            let content = flock_core::context_compression::compact_output(&content, compaction_level);
            let content = if toon_enabled {
                flock_core::context_compression::compact_output_toon(&content)
            } else {
                content
            };
            (
                ToolResult {
                    content,
                    is_error: r.is_error,
                },
                modifier,
            )
        }
        None => (
            ToolResult {
                content: format!("Unknown tool: {}", name),
                is_error: true,
            },
            None,
        ),
    };

    // Run post-tool-use hooks
    if let Some(hook_engine) = hooks {
        let messages = hook_engine
            .run_post_tool_use(name, input, &result.content)
            .await;
        for msg in messages {
            eprintln!("{}", msg);
        }
    }

    (
        ContentBlock::ToolResult {
            tool_use_id: id.clone(),
            content: result.content,
            is_error: result.is_error,
        },
        modifier,
    )
}

/// Execute tool calls with JSON stream ipc_interface approval flow
#[allow(clippy::too_many_arguments)]
pub async fn execute_tool_calls_with_approval(
    registry: &ToolRegistry,
    tool_calls: &[ContentBlock],
    approval_manager: &Arc<ToolApprovalManager>,
    writer: &Arc<dyn ProtocolEmitter>,
    msg_id: &str,
    auto_approve: bool,
    allow_list: &[String],
    mut hooks: Option<&mut HookEngine>,
    compaction_level: flock_core::context_compression::CompressionLevel,
    toon_enabled: bool,
) -> Result<ToolCallOutcome, ExecutionControl> {
    let mut results = Vec::new();
    let mut modifiers = Vec::new();

    for batch in group_calls(registry, tool_calls) {
        if batch.is_concurrent {
            let mut approved_calls = Vec::new();
            
            for call in &batch.calls {
                let ContentBlock::ToolUse { id, name, input } = call else { continue };
                let tool = registry.get(name);
                let category = tool.map(|t| t.category()).unwrap_or(ToolCategory::Exec);
                let description = tool.map(|t| t.describe(input)).unwrap_or_default();

                let needs_approval = !auto_approve
                    && !allow_list.contains(&name.to_string())
                    && !approval_manager.is_auto_approved(&category.to_string());

                if needs_approval {
                    let _ = writer.emit(&ProtocolEvent::ToolRequest {
                        msg_id: msg_id.to_string(),
                        call_id: id.clone(),
                        tool: ToolInfo {
                            name: name.clone(),
                            category,
                            args: input.clone(),
                            description,
                        },
                    });

                    let rx = approval_manager.request_approval(id, &category);
                    match rx.await {
                        Ok(ToolApprovalResult::Approved) => approved_calls.push(call),
                        Ok(ToolApprovalResult::Denied { reason }) => {
                            let _ = writer.emit(&ProtocolEvent::ToolCancelled {
                                msg_id: msg_id.to_string(),
                                call_id: id.clone(),
                                reason: reason.clone(),
                            });
                            results.push(ContentBlock::ToolResult {
                                tool_use_id: id.clone(),
                                content: format!("Tool denied: {reason}"),
                                is_error: true,
                            });
                            modifiers.push(None);
                        }
                        Err(_) => return Err(ExecutionControl::Quit),
                    }
                } else {
                    approved_calls.push(call);
                }
            }

            // Emit Running events for all approved
            for call in &approved_calls {
                if let ContentBlock::ToolUse { id, name, .. } = call {
                    let _ = writer.emit(&ProtocolEvent::ToolRunning {
                        msg_id: msg_id.to_string(),
                        call_id: id.clone(),
                        tool_name: name.clone(),
                    });
                }
            }

            // Execute approved concurrent tools in parallel
            let hooks_shared: Option<&HookEngine> = hooks.as_deref();
            let futures: Vec<_> = approved_calls
                .iter()
                .map(|call| {
                    execute_single(registry, call, hooks_shared, compaction_level, toon_enabled)
                })
                .collect();

            let batch_results = futures::future::join_all(futures).await;

            for (idx, (result, modifier)) in batch_results.into_iter().enumerate() {
                let call = approved_calls[idx];
                if let ContentBlock::ToolUse { id, name, .. } = call {
                    if let ContentBlock::ToolResult { content, is_error, .. } = &result {
                        let status = if *is_error { ToolStatus::Error } else { ToolStatus::Success };
                        let _ = writer.emit(&ProtocolEvent::ToolResult {
                            msg_id: msg_id.to_string(),
                            call_id: id.clone(),
                            tool_name: name.clone(),
                            status,
                            output: content.clone(),
                            output_type: OutputType::Text,
                            metadata: None,
                        });
                    }
                }
                results.push(result);
                modifiers.push(modifier);
            }
        } else {
            // Sequential execution for non-concurrent batches
            for call in &batch.calls {
                let ContentBlock::ToolUse { id, name, input } = call else { continue };

                let tool = registry.get(name);
                let category = tool.map(|t| t.category()).unwrap_or(ToolCategory::Exec);
                let description = tool.map(|t| t.describe(input)).unwrap_or_default();

                let needs_approval = !auto_approve
                    && !allow_list.contains(&name.to_string())
                    && !approval_manager.is_auto_approved(&category.to_string());

                if needs_approval {
                    let _ = writer.emit(&ProtocolEvent::ToolRequest {
                        msg_id: msg_id.to_string(),
                        call_id: id.clone(),
                        tool: ToolInfo {
                            name: name.clone(),
                            category,
                            args: input.clone(),
                            description,
                        },
                    });

                    let rx = approval_manager.request_approval(id, &category);
                    match rx.await {
                        Ok(ToolApprovalResult::Approved) => { /* continue */ }
                        Ok(ToolApprovalResult::Denied { reason }) => {
                            let _ = writer.emit(&ProtocolEvent::ToolCancelled {
                                msg_id: msg_id.to_string(),
                                call_id: id.clone(),
                                reason: reason.clone(),
                            });
                            results.push(ContentBlock::ToolResult {
                                tool_use_id: id.clone(),
                                content: format!("Tool denied: {reason}"),
                                is_error: true,
                            });
                            modifiers.push(None);
                            continue;
                        }
                        Err(_) => return Err(ExecutionControl::Quit),
                    }
                }

                let _ = writer.emit(&ProtocolEvent::ToolRunning {
                    msg_id: msg_id.to_string(),
                    call_id: id.clone(),
                    tool_name: name.clone(),
                });

                let result;
                let modifier;
                {
                    let hooks_shared: Option<&HookEngine> = hooks.as_deref();
                    (result, modifier) = execute_single(registry, call, hooks_shared, compaction_level, toon_enabled).await;
                }

                if let ContentBlock::ToolResult { content, is_error, .. } = &result {
                    let status = if *is_error { ToolStatus::Error } else { ToolStatus::Success };
                    let _ = writer.emit(&ProtocolEvent::ToolResult {
                        msg_id: msg_id.to_string(),
                        call_id: id.clone(),
                        tool_name: name.clone(),
                        status,
                        output: content.clone(),
                        output_type: OutputType::Text,
                        metadata: None,
                    });
                }

                if !block_is_error(&result) {
                    update_plugin_hooks(registry, call, hooks.as_deref_mut());
                }

                results.push(result);
                modifiers.push(modifier);
            }
        }
    }

    Ok(ToolCallOutcome { results, modifiers })
}

/// If `call` is a Skill tool call that returned successfully, parse and merge
/// its declared hooks into the active HookEngine.
/// If `call` is a Skill tool call that returned successfully, merge skill hooks into the engine.
fn merge_skill_hooks_into(engine: &mut HookEngine, registry: &ToolRegistry, call: &ContentBlock) {
    let ContentBlock::ToolUse { name, input, .. } = call else {
        return;
    };
    if name != "Skill" {
        return;
    }
    let Some(tool) = registry.get(name) else {
        return;
    };
    if let Some(skill_hooks) = tool.skill_hooks_for(input) {
        engine.merge_hooks(skill_hooks);
    }
}

fn update_plugin_hooks(
    registry: &ToolRegistry,
    call: &ContentBlock,
    hooks: Option<&mut HookEngine>,
) {
    if let Some(engine) = hooks {
        merge_skill_hooks_into(engine, registry, call);
    }
}

/// Returns true when a ContentBlock::ToolResult has is_error=true.
fn block_is_error(block: &ContentBlock) -> bool {
    matches!(block, ContentBlock::ToolResult { is_error: true, .. })
}

/// When a deferred tool fails AND the input is missing required fields from
/// its full schema, append a hint telling the LLM to call ToolSearch first.
/// If required fields are all present (or the schema has none), the original
/// error is returned unchanged — the failure is a runtime issue, not a
/// missing-schema problem.
fn maybe_append_deferred_hint(
    original_error: &str,
    schema: serde_json::Value,
    input: &serde_json::Value,
) -> String {
    let missing: Vec<&str> = schema["required"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .filter(|key| input.get(key).is_none())
                .collect()
        })
        .unwrap_or_default();

    if missing.is_empty() {
        return original_error.to_string();
    }

    format!(
        "{}\n\nThis is a deferred tool — its full parameter schema was not loaded. \
         Call ToolSearch to load the schema, then retry.",
        original_error
    )
}

fn truncate_result(content: &str, max_chars: usize) -> String {
    if content.len() <= max_chars {
        return content.to_string();
    }
    let half = max_chars / 2;
    // Find char boundaries to avoid panicking on multi-byte characters
    let head_end = content
        .char_indices()
        .nth(half)
        .map(|(i, _)| i)
        .unwrap_or(content.len());
    let tail_start = content
        .char_indices()
        .rev()
        .nth(half - 1)
        .map(|(i, _)| i)
        .unwrap_or(0);
    let head = &content[..head_end];
    let tail = &content[tail_start..];
    format!(
        "{}\n\n... [truncated {} chars] ...\n\n{}",
        head,
        content.len() - max_chars,
        tail
    )
}

fn truncate_display(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        // Find a char boundary to avoid panicking on multi-byte characters
        let end = s.char_indices().nth(max).map(|(i, _)| i).unwrap_or(s.len());
        format!("{}...", &s[..end])
    }
}

struct Batch<'a> {
    is_concurrent: bool,
    calls: Vec<&'a ContentBlock>,
}

fn group_calls<'a>(registry: &ToolRegistry, calls: &'a [ContentBlock]) -> Vec<Batch<'a>> {
    let mut batches: Vec<Batch<'a>> = Vec::new();

    for call in calls {
        let ContentBlock::ToolUse { name, input, .. } = call else {
            continue;
        };
        let is_safe = registry
            .get(name)
            .map(|t| t.is_concurrency_safe(input))
            .unwrap_or(false);

        match batches.last_mut() {
            Some(last) if last.is_concurrent && is_safe => {
                last.calls.push(call);
            }
            _ => {
                batches.push(Batch {
                    is_concurrent: is_safe,
                    calls: vec![call],
                });
            }
        }
    }

    batches
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // -- truncate_display -----------------------------------------------------

    #[test]
    fn truncate_display_ascii_short_unchanged() {
        assert_eq!(truncate_display("hello", 10), "hello");
    }

    #[test]
    fn truncate_display_ascii_truncated() {
        let result = truncate_display("hello world", 5);
        assert!(result.ends_with("..."));
        assert!(result.len() <= 20);
    }

    #[test]
    fn truncate_display_cjk_does_not_panic() {
        // 200 CJK chars: each is 3 bytes, so byte index 200 falls mid-character
        let cjk: String = "你好世界测试".chars().cycle().take(200).collect();
        let result = truncate_display(&cjk, 50);
        assert!(result.ends_with("..."));
    }

    #[test]
    fn truncate_display_mixed_cjk_ascii_does_not_panic() {
        let mixed = "abc你好def世界ghi测试".repeat(20);
        let result = truncate_display(&mixed, 30);
        assert!(result.ends_with("..."));
    }

    // -- truncate_result ------------------------------------------------------

    #[test]
    fn truncate_result_short_unchanged() {
        let s = "short content";
        assert_eq!(truncate_result(s, 1000), s);
    }

    #[test]
    fn truncate_result_cjk_does_not_panic() {
        let cjk: String = "这是一段较长的中文内容用于测试截断功能".repeat(50);
        let result = truncate_result(&cjk, 100);
        assert!(result.contains("truncated"));
    }

    #[test]
    fn truncate_result_mixed_cjk_ascii_does_not_panic() {
        let mixed = "Hello你好World世界Test测试".repeat(100);
        let result = truncate_result(&mixed, 200);
        assert!(result.contains("truncated"));
    }

    // -- maybe_append_deferred_hint -------------------------------------------

    #[test]
    fn deferred_hint_appended_when_required_field_missing() {
        let schema = json!({
            "type": "object",
            "properties": { "tasks": { "type": "array" } },
            "required": ["tasks"]
        });
        let input = json!({});
        let result = maybe_append_deferred_hint("Missing or invalid 'tasks' array", schema, &input);
        assert!(result.contains("Missing or invalid 'tasks' array"));
        assert!(result.contains("ToolSearch"));
    }

    #[test]
    fn deferred_hint_not_appended_when_required_fields_present() {
        let schema = json!({
            "type": "object",
            "properties": { "tasks": { "type": "array" } },
            "required": ["tasks"]
        });
        let input = json!({"tasks": [{"name": "t1", "prompt": "do x"}]});
        let result = maybe_append_deferred_hint("Some runtime error", schema, &input);
        assert_eq!(result, "Some runtime error");
        assert!(!result.contains("ToolSearch"));
    }

    #[test]
    fn deferred_hint_not_appended_when_no_required_field() {
        let schema = json!({
            "type": "object",
            "properties": {}
        });
        let input = json!({});
        let result = maybe_append_deferred_hint("some error", schema, &input);
        assert_eq!(result, "some error");
    }

    #[test]
    fn deferred_hint_not_appended_when_required_is_empty() {
        let schema = json!({
            "type": "object",
            "properties": {},
            "required": []
        });
        let input = json!({});
        let result = maybe_append_deferred_hint("some error", schema, &input);
        assert_eq!(result, "some error");
    }

    #[test]
    fn deferred_hint_appended_for_partial_missing_fields() {
        let schema = json!({
            "type": "object",
            "properties": {
                "a": { "type": "string" },
                "b": { "type": "string" }
            },
            "required": ["a", "b"]
        });
        let input = json!({"a": "present"});
        let result = maybe_append_deferred_hint("validation failed", schema, &input);
        assert!(result.contains("ToolSearch"));
    }

    // -- execute_single integration tests (deferred tool hint) ----------------

    use flock_tools::registry::ToolRegistry;
    use flock_tools::Tool;

    struct MockDeferredTool {
        schema: serde_json::Value,
    }

    #[async_trait::async_trait]
    impl Tool for MockDeferredTool {
        fn name(&self) -> &str {
            "MockDeferred"
        }
        fn description(&self) -> &str {
            "A mock deferred tool for testing"
        }
        fn input_schema(&self) -> serde_json::Value {
            self.schema.clone()
        }
        fn is_concurrency_safe(&self, _input: &serde_json::Value) -> bool {
            true
        }
        fn is_deferred(&self) -> bool {
            true
        }
        async fn execute(&self, input: serde_json::Value) -> flock_core::types::tool::ToolResult {
            if input.get("tasks").is_none() {
                return flock_core::types::tool::ToolResult {
                    content: "Missing or invalid 'tasks' array".to_string(),
                    is_error: true,
                };
            }
            flock_core::types::tool::ToolResult {
                content: "ok".to_string(),
                is_error: false,
            }
        }
        fn category(&self) -> flock_core::ipc_interface::events::ToolCategory {
            flock_core::ipc_interface::events::ToolCategory::Exec
        }
    }

    struct MockNonDeferredTool;

    #[async_trait::async_trait]
    impl Tool for MockNonDeferredTool {
        fn name(&self) -> &str {
            "MockNonDeferred"
        }
        fn description(&self) -> &str {
            "A mock non-deferred tool"
        }
        fn input_schema(&self) -> serde_json::Value {
            json!({
                "type": "object",
                "properties": { "cmd": { "type": "string" } },
                "required": ["cmd"]
            })
        }
        fn is_concurrency_safe(&self, _input: &serde_json::Value) -> bool {
            true
        }
        async fn execute(&self, input: serde_json::Value) -> flock_core::types::tool::ToolResult {
            if input.get("cmd").is_none() {
                return flock_core::types::tool::ToolResult {
                    content: "Missing cmd".to_string(),
                    is_error: true,
                };
            }
            flock_core::types::tool::ToolResult {
                content: "ok".to_string(),
                is_error: false,
            }
        }
        fn category(&self) -> flock_core::ipc_interface::events::ToolCategory {
            flock_core::ipc_interface::events::ToolCategory::Exec
        }
    }

    fn make_registry_with_deferred() -> ToolRegistry {
        let mut registry = ToolRegistry::new();
        registry.register(Box::new(MockDeferredTool {
            schema: json!({
                "type": "object",
                "properties": { "tasks": { "type": "array" } },
                "required": ["tasks"]
            }),
        }));
        registry.register(Box::new(MockNonDeferredTool));
        registry
    }

    #[tokio::test]
    async fn execute_single_deferred_tool_error_missing_required_appends_hint() {
        let registry = make_registry_with_deferred();
        let call = ContentBlock::ToolUse {
            id: "call_1".into(),
            name: "MockDeferred".into(),
            input: json!({}),
        };
        let (result, _) = execute_single(
            &registry,
            &call,
            None,
            flock_core::context_compression::CompressionLevel::Off,
            false,
        )
        .await;
        if let ContentBlock::ToolResult {
            content, is_error, ..
        } = &result
        {
            assert!(is_error);
            assert!(content.contains("Missing or invalid 'tasks' array"));
            assert!(content.contains("ToolSearch"));
        } else {
            panic!("expected ToolResult");
        }
    }

    #[tokio::test]
    async fn execute_single_deferred_tool_error_with_required_present_no_hint() {
        let registry = make_registry_with_deferred();
        // tasks is present but wrong type — tool still fails, but required field exists
        let call = ContentBlock::ToolUse {
            id: "call_2".into(),
            name: "MockDeferred".into(),
            input: json!({"tasks": "not_an_array"}),
        };
        let (result, _) = execute_single(
            &registry,
            &call,
            None,
            flock_core::context_compression::CompressionLevel::Off,
            false,
        )
        .await;
        if let ContentBlock::ToolResult {
            content, is_error, ..
        } = &result
        {
            // Tool succeeds because input.get("tasks") is Some
            assert!(!is_error);
            assert!(!content.contains("ToolSearch"));
        } else {
            panic!("expected ToolResult");
        }
    }

    #[tokio::test]
    async fn execute_single_deferred_tool_success_no_hint() {
        let registry = make_registry_with_deferred();
        let call = ContentBlock::ToolUse {
            id: "call_3".into(),
            name: "MockDeferred".into(),
            input: json!({"tasks": [{"name": "t1", "prompt": "do x"}]}),
        };
        let (result, _) = execute_single(
            &registry,
            &call,
            None,
            flock_core::context_compression::CompressionLevel::Off,
            false,
        )
        .await;
        if let ContentBlock::ToolResult {
            content, is_error, ..
        } = &result
        {
            assert!(!is_error);
            assert_eq!(content, "ok");
        } else {
            panic!("expected ToolResult");
        }
    }

    #[tokio::test]
    async fn execute_single_non_deferred_tool_error_no_hint() {
        let registry = make_registry_with_deferred();
        let call = ContentBlock::ToolUse {
            id: "call_4".into(),
            name: "MockNonDeferred".into(),
            input: json!({}),
        };
        let (result, _) = execute_single(
            &registry,
            &call,
            None,
            flock_core::context_compression::CompressionLevel::Off,
            false,
        )
        .await;
        if let ContentBlock::ToolResult {
            content, is_error, ..
        } = &result
        {
            assert!(is_error);
            assert!(content.contains("Missing cmd"));
            assert!(!content.contains("ToolSearch"));
        } else {
            panic!("expected ToolResult");
        }
    }
}
