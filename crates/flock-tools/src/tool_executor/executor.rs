use std::sync::Arc;
use flock_core::config::hooks::HookEngine;
use flock_core::ipc_interface::approval::{ToolApprovalManager, ToolApprovalResult};
use flock_core::ipc_interface::events::{OutputType, ProtocolEvent, ToolCategory, ToolInfo, ToolStatus};
use flock_core::ipc_interface::writer::ProtocolEmitter;
use flock_core::types::message::ContentBlock;
use flock_core::types::skill_types::ContextModifier;
use flock_core::types::tool::ToolResult;
use crate::registry::ToolRegistry;

use super::types::{ToolCallOutcome, ExecutionControl};
use super::helpers::{group_calls, truncate_result, maybe_append_deferred_hint};
use super::approval::{update_plugin_hooks, block_is_error};
use super::image_extract::extract_images_from_tool_result;

/// Partition tool calls and execute them with hooks
pub async fn run_tools(
    registry: &ToolRegistry,
    tool_calls: &[ContentBlock],
    mut hooks: Option<&mut HookEngine>,
    compaction_level: flock_core::context_compression::CompressionLevel,
    toon_enabled: bool,
    msg_id: &str,
) -> Result<ToolCallOutcome, ExecutionControl> {
    let mut results = Vec::new();
    let mut modifiers = Vec::new();

    for batch in group_calls(registry, tool_calls) {
        if batch.is_concurrent {
            // Reborrow as shared for concurrent execution.
            let hooks_shared: Option<&HookEngine> = hooks.as_deref();
            let futures: Vec<_> = batch.calls
                .iter()
                .map(|call| {
                    execute_single(registry, call, hooks_shared, compaction_level, toon_enabled, msg_id, None)
                })
                .collect();
            let batch_results = futures::future::join_all(futures).await;
            for (blocks, modifier) in batch_results {
                results.extend(blocks);
                modifiers.push(modifier);
            }
        } else {
            for call in &batch.calls {
                // Reborrow as shared for execute_single, then reclaim mut for merge.
                let blocks;
                let modifier;
                {
                    let hooks_shared: Option<&HookEngine> = hooks.as_deref();
                    (blocks, modifier) = execute_single(
                        registry,
                        call,
                        hooks_shared,
                        compaction_level,
                        toon_enabled,
                        msg_id,
                        None,
                    )
                    .await;
                }
                // Merge skill hooks after a successful sequential execution.
                if let Some(first_block) = blocks.first() {
                    if !block_is_error(first_block) {
                        update_plugin_hooks(registry, call, hooks.as_deref_mut());
                    }
                }
                results.extend(blocks);
                modifiers.push(modifier);
            }
        }
    }

    Ok(ToolCallOutcome { results, modifiers })
}

pub async fn execute_single(
    registry: &ToolRegistry,
    call: &ContentBlock,
    hooks: Option<&HookEngine>,
    compaction_level: flock_core::context_compression::CompressionLevel,
    toon_enabled: bool,
    msg_id: &str,
    feedback: Option<String>,
) -> (Vec<ContentBlock>, Option<ContextModifier>) {
    let ContentBlock::ToolUse { id, name, input } = call else {
        unreachable!("execute_single called with non-ToolUse block")
    };

    // Run pre-tool-use hooks
    if let Some(hook_engine) = hooks
        && let Err(e) = hook_engine.run_pre_tool_use(name, input).await
    {
        return (
            vec![ContentBlock::ToolResult {
                tool_use_id: id.clone(),
                content: format!("Blocked by hook: {}", e),
                is_error: true,
            }],
            None,
        );
    }

    let (result, modifier) = match registry.get(name) {
        Some(tool) => {
            let max_size = tool.max_result_size();
            let mut input_val = input.clone();
            if let Some(obj) = input_val.as_object_mut() {
                obj.insert("call_id".to_string(), serde_json::Value::String(id.clone()));
                obj.insert("msg_id".to_string(), serde_json::Value::String(msg_id.to_string()));
                if let Some(fb) = &feedback {
                    obj.insert("feedback".to_string(), serde_json::Value::String(fb.clone()));
                }
            }
            let r = tool.execute(input_val).await;
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
        extract_images_from_tool_result(result.content, id.clone(), result.is_error),
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
            let mut feedbacks = std::collections::HashMap::new();
            
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
                        Ok(ToolApprovalResult::Approved { feedback }) => {
                            approved_calls.push(call);
                            if let Some(fb) = feedback {
                                feedbacks.insert(id.clone(), fb);
                            }
                        }
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
                if let ContentBlock::ToolUse { id, name, input } = call {
                    let _ = writer.emit(&ProtocolEvent::ToolRunning {
                        msg_id: msg_id.to_string(),
                        call_id: id.clone(),
                        tool_name: name.clone(),
                        args: Some(input.clone()),
                    });
                }
            }

            // Execute approved concurrent tools in parallel
            let hooks_shared: Option<&HookEngine> = hooks.as_deref();
            let futures: Vec<_> = approved_calls
                .iter()
                .map(|call| {
                    let call_id = match call {
                        ContentBlock::ToolUse { id, .. } => id.clone(),
                        _ => String::new(),
                    };
                    let fb = feedbacks.get(&call_id).cloned();
                    execute_single(registry, call, hooks_shared, compaction_level, toon_enabled, msg_id, fb)
                })
                .collect();

            let batch_results = futures::future::join_all(futures).await;

            for (idx, (blocks, modifier)) in batch_results.into_iter().enumerate() {
                let call = approved_calls[idx];
                if let ContentBlock::ToolUse { id, name, .. } = call {
                    if let Some(ContentBlock::ToolResult { content, is_error, .. }) = blocks.first() {
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
                results.extend(blocks);
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

                let mut current_feedback = None;
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
                        Ok(ToolApprovalResult::Approved { feedback }) => {
                            current_feedback = feedback;
                        }
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
                    args: Some(input.clone()),
                });

                let blocks;
                let modifier;
                {
                    let hooks_shared: Option<&HookEngine> = hooks.as_deref();
                    (blocks, modifier) = execute_single(registry, call, hooks_shared, compaction_level, toon_enabled, msg_id, current_feedback).await;
                }

                if let Some(ContentBlock::ToolResult { content, is_error, .. }) = blocks.first() {
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

                if let Some(first_block) = blocks.first() {
                    if !block_is_error(first_block) {
                        update_plugin_hooks(registry, call, hooks.as_deref_mut());
                    }
                }

                results.extend(blocks);
                modifiers.push(modifier);
            }
        }
    }

    Ok(ToolCallOutcome { results, modifiers })
}
