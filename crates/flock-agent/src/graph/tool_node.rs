//! Custom ToolNode that wraps flock's `run_tools` executor.
//!
//! This node replaces both `confirm_node` and `exec_node` with a single node
//! that uses `interrupt()` for HITL approval (same pattern as the examples).
//!
//! Execution flow:
//! 1. Extract tool_calls from the last AI message
//! 2. Check if any tool needs approval (via `requires_approval()`)
//! 3. If approval needed → call `interrupt()` to pause the graph
//! 4. When resumed → read decision from interrupt return value
//! 5. If denied → create error tool results
//! 6. If quit → return empty (routing sends to END)
//! 7. Otherwise → execute via `run_tools` (handles batching, hooks, compression)
//! 8. Apply context modifiers (model, effort, allow_list, plan_mode)
//! 9. Return state patch with tool result messages

use std::sync::Arc;

use async_trait::async_trait;
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::{Runnable, RunnableError};
use serde_json::{json, Value as JsonValue};

use flock_core::types::message::{ContentBlock, Message, Role};

use crate::tool_executor::{run_tools, ExecutionControl};

use super::nodes::NodeContext;

/// A tool execution node that wraps flock's `run_tools` and supports
/// `interrupt()` for human-in-the-loop approval.
pub struct FlockToolNode {
    ctx: Arc<NodeContext>,
}

impl FlockToolNode {
    pub fn new(ctx: Arc<NodeContext>) -> Self {
        Self { ctx }
    }

    /// Extract tool calls from the last AI message in the state.
    fn extract_tool_calls(input: &JsonValue) -> Vec<ContentBlock> {
        let messages = match input.get("messages") {
            Some(JsonValue::Array(arr)) => arr,
            _ => return vec![],
        };

        for msg in messages.iter().rev() {
            if let Some(obj) = msg.as_object() {
                let role = obj.get("role").and_then(|v| v.as_str());
                let msg_type = obj.get("type").and_then(|v| v.as_str());

                // Match AI messages (either role="assistant" or type="ai")
                if role == Some("assistant") || msg_type == Some("ai") {
                    if let Some(JsonValue::Array(calls)) = obj.get("tool_calls") {
                        return calls
                            .iter()
                            .filter_map(|tc| serde_json::from_value(tc.clone()).ok())
                            .collect();
                    }
                    // Also check content array for ToolUse blocks
                    if let Some(JsonValue::Array(content)) = obj.get("content") {
                        let tool_uses: Vec<ContentBlock> = content
                            .iter()
                            .filter_map(|block| {
                                if block.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                                    serde_json::from_value(block.clone()).ok()
                                } else {
                                    None
                                }
                            })
                            .collect();
                        if !tool_uses.is_empty() {
                            return tool_uses;
                        }
                    }
                }
            }
        }

        vec![]
    }
}

#[async_trait]
impl Runnable for FlockToolNode {
    fn invoke(&self, input: &JsonValue, config: &RunnableConfig) -> Result<JsonValue, RunnableError> {
        match tokio::runtime::Handle::try_current() {
            Ok(handle) => handle.block_on(self.ainvoke(input, config)),
            Err(_) => {
                let rt = tokio::runtime::Runtime::new()
                    .map_err(|e| RunnableError::Node(e.to_string()))?;
                rt.block_on(self.ainvoke(input, config))
            }
        }
    }

    async fn ainvoke(&self, input: &JsonValue, _config: &RunnableConfig) -> Result<JsonValue, RunnableError> {
        self.ctx.output.emit_info("[node] >>> entering tools (FlockToolNode)");
        let tool_calls = Self::extract_tool_calls(input);

        self.ctx.output.emit_info(&format!(
            "[node] tools: extracted {} tool_calls",
            tool_calls.len()
        ));

        if tool_calls.is_empty() {
            self.ctx.output.emit_info("[node] <<< exiting tools (no tool_calls)");
            return Ok(json!({}));
        }

        // Check if any tool needs approval (same logic as old confirm_node)
        let needs_approval = tool_calls.iter().any(|call| {
            if let ContentBlock::ToolUse { name, .. } = call {
                self.ctx.confirmer.lock().unwrap().requires_approval(name)
            } else {
                false
            }
        });

        self.ctx.output.emit_info(&format!(
            "[node] tools: needs_approval={}",
            needs_approval
        ));

        // If approval needed, call interrupt() to pause the graph
        if needs_approval {
            self.ctx.output.emit_info("[node] tools: calling interrupt() for approval");

            let resume_val = match langgraph::types::interrupt(
                json!({ "pending_tool_calls": tool_calls.iter().filter_map(|c| serde_json::to_value(c).ok()).collect::<Vec<_>>() })
            ) {
                Ok(val) => val,
                Err(e) => return Err(RunnableError::Interrupt(e.into())),
            };

            // Read decision from resume value
            let decision = if let Some(s) = resume_val.as_str() {
                s.to_string()
            } else if let Some(obj) = resume_val.as_object() {
                obj.get("decision").and_then(|v| v.as_str()).unwrap_or("approved").to_string()
            } else {
                "approved".to_string()
            };

            let passed_results: Option<Vec<ContentBlock>> = resume_val
                .get("results")
                .and_then(|v| serde_json::from_value(v.clone()).ok());

            self.ctx.output.emit_info(&format!(
                "[node] tools: resume decision = {}, has_passed_results = {}",
                decision,
                passed_results.is_some()
            ));

            if let Some(results) = passed_results {
                // If results are passed from the engine (GUI mode), use them directly without executing tools again
                for result in &results {
                    if let ContentBlock::ToolResult { content, is_error, tool_use_id } = result {
                        let tool_name = tool_calls
                            .iter()
                            .find_map(|c| {
                                if let ContentBlock::ToolUse { id, name, .. } = c
                                    && id == tool_use_id
                                {
                                    return Some(name.as_str());
                                }
                                None
                            })
                            .unwrap_or("unknown");
                        self.ctx.output.emit_tool_result(tool_name, *is_error, content);
                    }
                }

                let result_msg = Message::now(Role::User, results);
                let result_messages = match serde_json::to_value(&result_msg) {
                    Ok(v) => vec![v],
                    Err(_) => vec![],
                };

                self.ctx.output.emit_info(&format!("[node] <<< exiting tools (using passed results, decision={})", decision));
                
                // If decision was quit, we should let route_after_tools route to END
                let mut patch = json!({
                    "messages": result_messages,
                });
                if decision == "quit" {
                    patch["quit_requested"] = json!(true);
                }
                return Ok(patch);
            }

            match decision.as_str() {
                "quit" => {
                    self.ctx.output.emit_info("[node] <<< exiting tools (quit)");
                    // 返回 quit_requested=true，让 route_after_tools 路由到 END
                    return Ok(json!({
                        "quit_requested": true,
                    }));
                }
                "denied" => {
                    // Tools denied — create error results (terminal mode fallback)
                    let results: Vec<ContentBlock> = tool_calls
                        .iter()
                        .filter_map(|c| {
                            if let ContentBlock::ToolUse { id, .. } = c {
                                Some(ContentBlock::ToolResult {
                                    tool_use_id: id.clone(),
                                    content: "Tool execution denied by user".to_string(),
                                    is_error: true,
                                })
                            } else {
                                None
                            }
                        })
                        .collect();

                    for result in &results {
                        if let ContentBlock::ToolResult { content, is_error, tool_use_id } = result {
                            let tool_name = tool_calls
                                .iter()
                                .find_map(|c| {
                                    if let ContentBlock::ToolUse { id, name, .. } = c
                                        && id == tool_use_id
                                    {
                                        return Some(name.as_str());
                                    }
                                    None
                                })
                                .unwrap_or("unknown");
                            self.ctx.output.emit_tool_result(tool_name, *is_error, content);
                        }
                    }

                    let result_msg = Message::now(Role::User, results);
                    let result_messages = match serde_json::to_value(&result_msg) {
                        Ok(v) => vec![v],
                        Err(_) => vec![],
                    };

                    self.ctx.output.emit_info("[node] <<< exiting tools (denied)");
                    return Ok(json!({
                        "messages": result_messages,
                    }));
                }
                _ => {
                    // Approved — continue to execute tools (terminal mode fallback)
                    self.ctx.output.emit_info("[node] tools: approved, executing tools...");
                }
            }
        }

        // Execute tools via flock's run_tools (handles batching, hooks, compression)
        self.ctx.output.emit_info(&format!(
            "[node] tools: calling run_tools with {} tool_calls",
            tool_calls.len()
        ));
        let outcome = match run_tools(
            &self.ctx.tools,
            &tool_calls,
            None, // No confirmer — approval handled above via interrupt()
            None, // No hooks in graph node mode
            self.ctx.compaction_level,
            self.ctx.toon_enabled,
        )
        .await
        {
            Ok(o) => o,
            Err(ExecutionControl::Quit) => {
                self.ctx.output.emit_info("[node] <<< exiting tools (quit from run_tools)");
                return Ok(json!({}));
            }
        };

        // Emit tool results
        for result in &outcome.results {
            if let ContentBlock::ToolResult { content, is_error, tool_use_id } = result {
                let tool_name = tool_calls
                    .iter()
                    .find_map(|c| {
                        if let ContentBlock::ToolUse { id, name, .. } = c
                            && id == tool_use_id
                        {
                            return Some(name.as_str());
                        }
                        None
                    })
                    .unwrap_or("unknown");
                self.ctx.output.emit_tool_result(tool_name, *is_error, content);
            }
        }

        // Apply context modifiers from skill tools
        let mut new_allow_list: Option<Vec<String>> = None;
        let mut new_model: Option<String> = None;
        let mut new_effort: Option<String> = None;
        let mut new_plan_active: Option<bool> = None;
        let mut new_pre_plan: Option<Vec<String>> = None;

        for modifier in outcome.modifiers.iter().flatten() {
            if let Some(ref m) = modifier.model {
                new_model = Some(m.clone());
            }
            if let Some(effort) = modifier.effort {
                new_effort = Some(flock_core::types::skill_types::effort_to_string(effort));
            }
            for tool_name in &modifier.allowed_tools {
                let list = new_allow_list.get_or_insert_with(|| {
                    input.get("allow_list")
                        .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
                        .unwrap_or_default()
                });
                if !list.contains(tool_name) {
                    list.push(tool_name.clone());
                    self.ctx.confirmer.lock().unwrap().add_to_allow_list(tool_name);
                }
            }
            if let Some(transition) = &modifier.plan_mode_transition {
                match transition {
                    flock_core::types::skill_types::PlanModeTransition::Enter => {
                        let current_allow = new_allow_list.clone().unwrap_or_else(|| {
                            input.get("allow_list")
                                .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
                                .unwrap_or_default()
                        });
                        new_pre_plan = Some(current_allow);
                        new_plan_active = Some(true);
                        if let Some(ref flag) = self.ctx.plan_active_flag {
                            flag.store(true, std::sync::atomic::Ordering::Release);
                        }
                        self.ctx.output.emit_info("Plan Mode activated — only Info tools allowed");
                    }
                    flock_core::types::skill_types::PlanModeTransition::Exit { plan_content } => {
                        new_plan_active = Some(false);
                        let pre_plan = input.get("pre_plan_allow_list")
                            .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
                            .unwrap_or_default();
                        new_allow_list = Some(pre_plan.clone());
                        new_pre_plan = Some(pre_plan);
                        if let Some(ref flag) = self.ctx.plan_active_flag {
                            flag.store(false, std::sync::atomic::Ordering::Release);
                        }
                        self.ctx.output.emit_info("Plan Mode exited — full tool access restored");

                        if let Some(content) = plan_content {
                            if let Some(session_id) = &self.ctx.session_id {
                                let plan_dir = std::path::Path::new(&self.ctx.plan_config.plan_directory);
                                let path = crate::plan::file::plan_file_path(plan_dir, session_id);
                                if let Err(e) = crate::plan::file::write_plan(&path, content) {
                                    self.ctx.output.emit_error(&format!("Failed to save plan: {e}"));
                                } else {
                                    self.ctx.output.emit_info(&format!("Plan saved to: {}", path.display()));
                                }
                            }
                        }
                    }
                }
            }
        }

        // Build result message
        let result_msg = Message::now(Role::User, outcome.results.clone());
        let result_messages = match serde_json::to_value(&result_msg) {
            Ok(v) => vec![v],
            Err(_) => vec![],
        };

        let mut result = json!({
            "messages": result_messages,
        });

        // Apply optional state updates from modifiers
        if let Some(obj) = result.as_object_mut() {
            if let Some(allow_list) = new_allow_list {
                obj.insert("allow_list".to_string(), json!(allow_list));
            }
            if let Some(model) = new_model {
                obj.insert("model".to_string(), json!(model));
            }
            if let Some(effort) = new_effort {
                obj.insert("reasoning_effort".to_string(), json!(effort));
            }
            if let Some(active) = new_plan_active {
                obj.insert("plan_mode_active".to_string(), json!(active));
            }
            if let Some(pre_plan) = new_pre_plan {
                obj.insert("pre_plan_allow_list".to_string(), json!(pre_plan));
            }
        }

        self.ctx.output.emit_info(&format!(
            "[node] <<< exiting tools (executed {} tool_calls)",
            tool_calls.len()
        ));
        Ok(result)
    }

    fn name(&self) -> &str {
        "FlockToolNode"
    }
}
