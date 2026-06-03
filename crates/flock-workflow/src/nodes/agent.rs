use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use flock_core::ipc_interface::events::ProtocolEvent;
use flock_core::ipc_interface::writer::ProtocolEmitter;
use flock_core::types::message::ContentBlock;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context, resolve_model, parse_retry_config, parse_timeout_config, execute_with_retry, WorkflowSink};

struct WorkflowEmitter {
    sink: Arc<dyn WorkflowSink>,
    node_id: String,
}

impl ProtocolEmitter for WorkflowEmitter {
    fn emit(&self, event: &ProtocolEvent) -> Result<(), std::io::Error> {
        match event {
            ProtocolEvent::ToolRequest { call_id, tool, .. } => {
                self.sink.emit_tool_request(call_id, &tool.name, &tool.category, &tool.args);
            }
            ProtocolEvent::ToolRunning { call_id, tool_name, args, .. } => {
                let default_args = json!({});
                let args_val = args.as_ref().unwrap_or(&default_args);
                self.sink.emit_tool_running(call_id, tool_name, args_val);
                self.sink.emit_text_delta(&self.node_id, &format!("\n\n*🔧 Calling tool `{}`...*\n", tool_name));
            }
            ProtocolEvent::ToolResult { call_id, tool_name, status, output, .. } => {
                let status_str = match status {
                    flock_core::ipc_interface::events::ToolStatus::Success => "success",
                    flock_core::ipc_interface::events::ToolStatus::Error => "error",
                };
                self.sink.emit_tool_result(call_id, tool_name, status_str, output);
                self.sink.emit_text_delta(&self.node_id, &format!("*Tool `{}` returned result: {}*\n\n", tool_name, output));
            }
            ProtocolEvent::ToolCancelled { call_id, reason, .. } => {
                self.sink.emit_tool_cancelled(call_id, "", reason);
            }
            _ => {}
        }
        Ok(())
    }
}

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

                    let mut tool_names: Vec<String> = node_data.get("tools")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    let node_skills: Vec<String> = node_data.get("skills")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    // If the node has explicitly bound skills, automatically enable the 'Skill' tool!
                    if !node_skills.is_empty() {
                        if !tool_names.contains(&"Skill".to_string()) {
                            tool_names.push("Skill".to_string());
                        }
                    }

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

                    ctx.sink.emit_text_delta(&node_id, "\u{200b}");

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
                        if ctx.cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                            return Err("Workflow execution cancelled by user".to_string());
                        }

                        let mut rx = provider.astream(&local_messages[..], &config);
                        let mut assistant_text = String::new();
                        let mut thinking_text = String::new();
                        let mut tool_calls = Vec::new();

                        while let Some(msg_res) = rx.next().await {
                            if ctx.cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                                return Err("Workflow execution cancelled by user".to_string());
                            }
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

                        // Convert ToolCall to ContentBlock
                        let content_blocks: Vec<ContentBlock> = tool_calls.iter().map(|tc| {
                            ContentBlock::ToolUse {
                                id: tc.id.clone().unwrap_or_else(|| format!("{}_{}", tc.name, chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0))),
                                name: tc.name.clone(),
                                input: tc.args.clone(),
                            }
                        }).collect();

                        let sensitive_tools: Vec<String> = node_data.get("sensitive_tools")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                            .unwrap_or_default();

                        // allow_list is all registered tool names minus sensitive_tools
                        let all_tool_names: Vec<String> = ctx.tools.to_tool_defs_filtered(|_| true)
                            .into_iter()
                            .map(|t| t.name)
                            .collect();
                        let allow_list: Vec<String> = all_tool_names.into_iter()
                            .filter(|t| !sensitive_tools.contains(t))
                            .collect();

                        let emitter = Arc::new(WorkflowEmitter {
                            sink: ctx.sink.clone(),
                            node_id: node_id.clone(),
                        });
                        let emitter_dyn: Arc<dyn ProtocolEmitter> = emitter;

                        // Call execute_tool_calls_with_approval
                        let outcome = flock_tools::tool_executor::execute_tool_calls_with_approval(
                            &ctx.tools,
                            &content_blocks,
                            &ctx.approval_manager,
                            &emitter_dyn,
                            &node_id,
                            false,
                            &allow_list,
                            None,
                            flock_core::context_compression::CompressionLevel::Safe,
                            false,
                        ).await;

                        match outcome {
                            Ok(outcome) => {
                                for block in outcome.results {
                                    if let ContentBlock::ToolResult { tool_use_id, content, is_error } = block {
                                        let tool_msg = LgMessage::Tool {
                                            tool_call_id: tool_use_id,
                                            content: langgraph_prebuilt::types::MessageContent::Text(content),
                                            name: None,
                                            id: None,
                                            status: if is_error { "error".to_string() } else { "success".to_string() },
                                        };
                                        local_messages.push(tool_msg.clone());
                                        run_messages.push(tool_msg);
                                    }
                                }
                            }
                            Err(_) => {
                                return Err("Tool execution aborted".to_string());
                            }
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

            if let Err(ref e) = result {
                ctx.sink.emit_error(e);
                if let Ok(mut guard) = ctx.has_error.lock() {
                    *guard = Some(e.clone());
                }
            }

            result.map_err(|e| RunnableError::Node(e))
        })
    }
}
