use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context, resolve_model, parse_retry_config, parse_timeout_config, execute_with_retry};

pub fn make_agent_workflow_node(
    node_id: String,
    node_data: JsonValue,
    ctx: Arc<WorkflowNodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, config: RunnableConfig| {
        let ctx = ctx.clone();
        let node_id = node_id.clone();
        let node_data = node_data.clone();
        Box::pin(async move {
            ctx.sink.emit_node_start(&node_id);
            let retry_cfg = parse_retry_config(&node_data);
            let timeout_cfg = parse_timeout_config(&node_data);

            let result = execute_with_retry(&retry_cfg, &timeout_cfg, || {
                let ctx = ctx.clone();
                let node_id = node_id.clone();
                let node_data = node_data.clone();
                let input = input.clone();
                let config = config.clone();
                async move {
                    let state = parse_state(&input);

                    let sys_template = node_data.get("systemMessage").and_then(|v| v.as_str()).unwrap_or("");
                    let user_template = node_data.get("userMessage").and_then(|v| v.as_str()).unwrap_or("");

                    let mut sys_prompt = interpolate_string_with_context(sys_template, &state, &ctx, &ctx.workflow_id);
                    let user_prompt = interpolate_string_with_context(user_template, &state, &ctx, &ctx.workflow_id);

                    let tool_names: Vec<String> = node_data.get("tools")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    // If 'Skill' tool is enabled, dynamically load all skills and inject them to system prompt
                    if tool_names.contains(&"Skill".to_string()) {
                        let cwd = std::env::current_dir().unwrap_or_default();
                        let mut raw_paths = Vec::new();

                        // Query imported skills from database
                        if let Ok(rows) = sqlx::query("SELECT path FROM imported_skill")
                            .fetch_all(ctx.db.pool())
                            .await
                        {
                            use sqlx::Row;
                            for row in rows {
                                let path_res: Result<String, sqlx::Error> = row.try_get::<String, &str>("path");
                                if let Ok(path_str) = path_res {
                                    raw_paths.push(std::path::PathBuf::from(path_str));
                                }
                            }
                        }

                        // Query extra_skill_dirs from config
                        let mut extra_dirs = Vec::new();
                        if let Ok(row) = sqlx::query("SELECT value FROM config WHERE key = 'extra_skill_dirs'")
                            .fetch_optional(ctx.db.pool())
                            .await
                        {
                            if let Some(r) = row {
                                use sqlx::Row;
                                let val_res: Result<String, sqlx::Error> = r.try_get::<String, &str>("value");
                                if let Ok(val_str) = val_res {
                                    if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&val_str) {
                                        extra_dirs = parsed;
                                    }
                                }
                            }
                        }
                        for d in extra_dirs {
                            raw_paths.push(std::path::PathBuf::from(d));
                        }

                        let node_skills: Vec<String> = node_data.get("skills")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();

                        let skills = flock_skills::loader::load_all_skills(&cwd, &[], false, None, &raw_paths).await;
                        let visible_skills: Vec<_> = skills
                            .iter()
                            .filter(|s| {
                                !s.disable_model_invocation && 
                                !node_skills.is_empty() && node_skills.contains(&s.name)
                            })
                            .cloned()
                            .collect();

                        if !visible_skills.is_empty() {
                            let listing = flock_skills::prompt::format_skills_within_budget(&visible_skills, None);
                            if !listing.is_empty() {
                                sys_prompt.push_str(&format!(
                                    "\n\n<system-reminder>\nThe following skills are available for use with the Skill tool:\n\n{}\n</system-reminder>",
                                    listing
                                ));
                            }
                        }
                    }

                    let tool_defs = ctx.tools.to_tool_defs_filtered(|t| tool_names.contains(&t.name().to_string()));
                    let bound_tools: Vec<_> = tool_defs.into_iter().map(|t| langgraph_prebuilt::ToolDef {
                        name: t.name,
                        description: t.description,
                        parameters: t.input_schema,
                    }).collect();

                    let model = resolve_model(&node_data, &ctx);
                    let provider = model.bind_tools(bound_tools);

                    let mut local_messages = Vec::new();
                    if !sys_prompt.is_empty() {
                        local_messages.push(LgMessage::system(sys_prompt));
                    }
                    for m in &state.messages {
                        if let Ok(lg_msg) = serde_json::from_value::<LgMessage>(m.clone()) {
                            local_messages.push(lg_msg);
                        }
                    }

                    let mut run_messages = Vec::new();
                    if !user_prompt.is_empty() {
                        let human_msg = LgMessage::human(user_prompt.clone());
                        local_messages.push(human_msg.clone());
                        run_messages.push(human_msg);
                    }

                    let mut loop_count = 0;
                    let max_loops = 10;
                    let mut final_response = String::new();

                    loop {
                        loop_count += 1;
                        if loop_count > max_loops {
                            return Err("Max tool loop count exceeded".to_string());
                        }

                        let mut rx = provider.astream(&local_messages[..], &config);
                        let mut assistant_text = String::new();
                        let mut thinking_text = String::new();
                        let mut tool_calls = Vec::new();

                        while let Some(msg_res) = rx.next().await {
                            let msg = msg_res.map_err(|e| format!("{}", e))?;
                            if let Some(thinking) = msg.thinking() {
                                if !thinking.is_empty() {
                                    ctx.sink.emit_thinking(&node_id, thinking);
                                    thinking_text.push_str(thinking);
                                }
                            }
                            if let Some(content) = msg.text() {
                                if !content.is_empty() {
                                    ctx.sink.emit_text_delta(&node_id, content);
                                    assistant_text.push_str(content);
                                }
                            }
                            for tc in msg.tool_calls() {
                                tool_calls.push(tc.clone());
                            }
                        }
                        drop(rx);
                        log::info!("[workflow agent node] stream finished. assistant_text: '{}', tool_calls count: {}", assistant_text, tool_calls.len());

                        final_response = assistant_text.clone();

                        let ai_msg = LgMessage::ai_with_tool_calls(assistant_text.clone(), tool_calls.clone());
                        local_messages.push(ai_msg.clone());
                        run_messages.push(ai_msg);

                        if tool_calls.is_empty() {
                            log::info!("[workflow agent node] tool_calls is empty, breaking loop");
                            break;
                        }

                        for tc in tool_calls {
                            log::info!("[workflow agent node] processing tool call: name={}, id={:?}", tc.name, tc.id);
                            let sensitive_tools: Vec<String> = node_data.get("sensitive_tools")
                                .and_then(|v| v.as_array())
                                .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                                .unwrap_or_default();
                            log::info!("[workflow agent node] sensitive_tools configuration: {:?}", sensitive_tools);

                            let tool = ctx.tools.get(&tc.name);
                            let category = tool.as_ref().map(|t| t.category()).unwrap_or(flock_core::ipc_interface::events::ToolCategory::Exec);

                            let call_id = tc.id.clone().unwrap_or_else(|| format!("{}_{}", tc.name, chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
                            let needs_approval = sensitive_tools.contains(&tc.name);
                            log::info!("[workflow agent node] tool call needs_approval: {}", needs_approval);

                            if needs_approval {
                                ctx.sink.emit_tool_request(&call_id, &tc.name, &category, &tc.args);
                                let rx = ctx.approval_manager.request_approval(&call_id, &category);
                                match rx.await {
                                    Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Approved) => {
                                        ctx.sink.emit_tool_running(&call_id, &tc.name, &tc.args);
                                    }
                                    Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Denied { reason }) => {
                                        ctx.sink.emit_tool_cancelled(&call_id, &tc.name, &reason);
                                        let tool_msg = LgMessage::Tool {
                                            tool_call_id: call_id,
                                            content: langgraph_prebuilt::types::MessageContent::Text(format!("Tool execution denied by user: {}", reason)),
                                            name: None,
                                            id: None,
                                            status: "error".to_string(),
                                        };
                                        local_messages.push(tool_msg.clone());
                                        run_messages.push(tool_msg);
                                        continue;
                                    }
                                    Err(_) => return Err("Tool approval communication failed".to_string()),
                                }
                            }

                            ctx.sink.emit_text_delta(&node_id, &format!("\n\n*🔧 调用工具 `{}`...*\n", tc.name));
                            let tool = ctx.tools.get(&tc.name).ok_or_else(|| {
                                format!("Tool not found: {}", tc.name)
                            })?;

                            let tool_res = tool.execute(tc.args.clone()).await;
                            ctx.sink.emit_text_delta(&node_id, &format!("*工具 `{}` 返回结果: {}*\n\n", tc.name, tool_res.content));

                            if needs_approval {
                                let status = if tool_res.is_error { "error" } else { "success" };
                                ctx.sink.emit_tool_result(&call_id, &tc.name, status, &tool_res.content);
                            }

                            let tool_msg = LgMessage::Tool {
                                tool_call_id: call_id,
                                content: langgraph_prebuilt::types::MessageContent::Text(tool_res.content.clone()),
                                name: None,
                                id: None,
                                status: if tool_res.is_error { "error".to_string() } else { "success".to_string() },
                            };
                            local_messages.push(tool_msg.clone());
                            run_messages.push(tool_msg);
                        }
                    }

                    let mut outputs = state.node_outputs.clone();
                    if !outputs.is_object() {
                        outputs = json!({});
                    }
                    let node_output = json!({
                        "response": final_response
                    });
                    outputs[&node_id] = node_output.clone();

                    ctx.sink.emit_node_done(&node_id, &node_output);

                    Ok::<JsonValue, String>(json!({
                        "node_outputs": outputs,
                        "current_node": node_id,
                        "messages": run_messages,
                    }))
                }
            }).await;

            result.map_err(|e| RunnableError::Node(e))
        })
    }
}
