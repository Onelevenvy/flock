use serde_json::{json, Value as JsonValue};
use langgraph::runnable::RunnableError;
use flock_core::types::message::{ContentBlock, Message, Role};
use flock_tools::tool_executor::{run_tools, ExecutionControl};
use flock_tools::approval::ToolConfirmer;
use super::FlockToolNode;
use super::extract::extract_tool_calls;

pub async fn ainvoke_impl(
    node: &FlockToolNode,
    input: &JsonValue,
) -> Result<JsonValue, RunnableError> {
    node.ctx.output.emit_info("[node] >>> entering tools (FlockToolNode)");
    let tool_calls = extract_tool_calls(input);

    node.ctx.output.emit_info(&format!(
        "[node] tools: extracted {} tool_calls",
        tool_calls.len()
    ));

    if tool_calls.is_empty() {
        node.ctx.output.emit_info("[node] <<< exiting tools (no tool_calls)");
        return Ok(json!({}));
    }

    // Check if any tool needs approval (same logic as old confirm_node)
    let needs_approval = tool_calls.iter().any(|call| {
        if let ContentBlock::ToolUse { name, .. } = call {
            node.ctx.confirmer.lock().unwrap().requires_approval(name)
        } else {
            false
        }
    });

    node.ctx.output.emit_info(&format!(
        "[node] tools: needs_approval={}",
        needs_approval
    ));

    // If approval needed and in GUI mode, execute with approval directly in the node
    if needs_approval && let Some(ref approval_mgr) = node.ctx.approval_manager {
        node.ctx.output.emit_info("[node] tools: GUI mode approval requested. Starting execute_tool_calls_with_approval inside node");

        let writer = node.ctx.protocol_writer.as_ref()
            .expect("protocol_writer must be set when approval_manager is set");
        let auto_approve = node.ctx.confirmer.lock().unwrap().is_auto_approve();
        let msg_id = node.ctx.msg_id.lock().unwrap().clone();
        
        let allow_list = input.get("allow_list")
            .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
            .unwrap_or_default();

        use std::sync::atomic::Ordering;
        use flock_tools::tool_executor::execute_tool_calls_with_approval;
        use flock_tools::tool_executor::ExecutionControl;

        let outcome_res = tokio::select! {
            _ = async {
                loop {
                    if node.ctx.cancel_flag.load(Ordering::Relaxed) {
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                }
            } => {
                // Emit ToolCancelled events so frontend can clean up UI components
                use flock_core::ipc_interface::events::ProtocolEvent;
                for call in &tool_calls {
                    if let ContentBlock::ToolUse { id, .. } = call {
                        let _ = writer.emit(&ProtocolEvent::ToolCancelled {
                            msg_id: msg_id.clone(),
                            call_id: id.clone(),
                            reason: "Session aborted by user".to_string(),
                        });
                    }
                }
                Err(ExecutionControl::Quit)
            }
            res = execute_tool_calls_with_approval(
                &node.ctx.tools,
                &tool_calls,
                approval_mgr,
                writer,
                &msg_id,
                auto_approve,
                &allow_list,
                None, // No plugins/hooks at graph node execution stage
                node.ctx.compaction_level,
                node.ctx.toon_enabled,
            ) => {
                res.map_err(|_| ExecutionControl::Quit)
            }
        };

        let outcome = match outcome_res {
            Ok(o) => o,
            Err(ExecutionControl::Quit) => {
                node.ctx.output.emit_info("[node] <<< exiting tools due to cancel or quit");
                *node.ctx.has_error.lock().unwrap() = Some("UserAborted".to_string());
                return Ok(json!({
                    "quit_requested": true,
                }));
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
                node.ctx.output.emit_tool_result(tool_name, *is_error, content);
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
                    node.ctx.confirmer.lock().unwrap().add_to_allow_list(tool_name);
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
                        if let Some(ref flag) = node.ctx.plan_active_flag {
                            flag.store(true, std::sync::atomic::Ordering::Release);
                        }
                        node.ctx.output.emit_info("Plan Mode activated — only Info tools allowed");
                    }
                    flock_core::types::skill_types::PlanModeTransition::Exit { plan_content } => {
                        new_plan_active = Some(false);
                        let pre_plan = input.get("pre_plan_allow_list")
                            .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
                            .unwrap_or_default();
                        new_allow_list = Some(pre_plan.clone());
                        new_pre_plan = Some(pre_plan);
                        if let Some(ref flag) = node.ctx.plan_active_flag {
                            flag.store(false, std::sync::atomic::Ordering::Release);
                        }
                        node.ctx.output.emit_info("Plan Mode exited — full tool access restored");

                        if let Some(content) = plan_content {
                            if let Some(session_id) = &node.ctx.session_id {
                                let plan_dir = std::path::Path::new(&node.ctx.plan_config.plan_directory);
                                let path = crate::tools::plan::file::plan_file_path(plan_dir, session_id);
                                if let Err(e) = crate::tools::plan::file::write_plan(&path, content) {
                                    node.ctx.output.emit_error(&format!("Failed to save plan: {e}"));
                                } else {
                                    node.ctx.output.emit_info(&format!("Plan saved to: {}", path.display()));
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

        node.ctx.output.emit_info(&format!(
            "[node] <<< exiting tools (executed {} tool_calls)",
            tool_calls.len()
        ));
        return Ok(result);
    }

    // Execute tools via flock's run_tools (handles batching, hooks, compression)
    node.ctx.output.emit_info(&format!(
        "[node] tools: calling run_tools with {} tool_calls",
        tool_calls.len()
    ));
    let msg_id = node.ctx.msg_id.lock().unwrap().clone();
    let outcome = match run_tools(
        &node.ctx.tools,
        &tool_calls,
        None, // No confirmer — approval handled above via interrupt()
        None, // No hooks in graph node mode
        node.ctx.compaction_level,
        node.ctx.toon_enabled,
        &msg_id,
    )
    .await
    {
        Ok(o) => o,
        Err(ExecutionControl::Quit) => {
            node.ctx.output.emit_info("[node] <<< exiting tools (quit from run_tools)");
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
            node.ctx.output.emit_tool_result(tool_name, *is_error, content);
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
                node.ctx.confirmer.lock().unwrap().add_to_allow_list(tool_name);
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
                    if let Some(ref flag) = node.ctx.plan_active_flag {
                        flag.store(true, std::sync::atomic::Ordering::Release);
                    }
                    node.ctx.output.emit_info("Plan Mode activated — only Info tools allowed");
                }
                flock_core::types::skill_types::PlanModeTransition::Exit { plan_content } => {
                    new_plan_active = Some(false);
                    let pre_plan = input.get("pre_plan_allow_list")
                        .and_then(|v| serde_json::from_value::<Vec<String>>(v.clone()).ok())
                        .unwrap_or_default();
                    new_allow_list = Some(pre_plan.clone());
                    new_pre_plan = Some(pre_plan);
                    if let Some(ref flag) = node.ctx.plan_active_flag {
                        flag.store(false, std::sync::atomic::Ordering::Release);
                    }
                    node.ctx.output.emit_info("Plan Mode exited — full tool access restored");

                    if let Some(content) = plan_content {
                        if let Some(session_id) = &node.ctx.session_id {
                            let plan_dir = std::path::Path::new(&node.ctx.plan_config.plan_directory);
                            let path = crate::tools::plan::file::plan_file_path(plan_dir, session_id);
                            if let Err(e) = crate::tools::plan::file::write_plan(&path, content) {
                                node.ctx.output.emit_error(&format!("Failed to save plan: {e}"));
                            } else {
                                node.ctx.output.emit_info(&format!("Plan saved to: {}", path.display()));
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

    node.ctx.output.emit_info(&format!(
        "[node] <<< exiting tools (executed {} tool_calls)",
        tool_calls.len()
    ));
    Ok(result)
}
