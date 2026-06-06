use std::sync::atomic::{Ordering, AtomicBool};
use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use langgraph::types::StreamMode;
use tokio_stream::StreamExt;
use serde_json::Value as JsonValue;

use flock_core::types::message::{ContentBlock, Message, Role, StopReason, TokenUsage};
use crate::engine::{AgentEngine, AgentResult, AgentError};
use crate::graph::{build_agent_graph, AgentState, NodeContext};

use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserAttachment {
    pub id: String,
    pub kind: String, // "image" | "file"
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub data_base64: Option<String>,
}

fn clean_base64(data_b64: &str) -> &str {
    if let Some(pos) = data_b64.find(',') {
        &data_b64[pos + 1..]
    } else {
        data_b64
    }
}

fn decode_base64(data_b64: &str) -> Result<Vec<u8>, anyhow::Error> {
    use base64::{Engine as _, engine::general_purpose};
    let clean = clean_base64(data_b64);
    general_purpose::STANDARD.decode(clean.trim())
        .map_err(|e| anyhow::anyhow!("Base64 decode error: {}", e))
}

pub async fn prepare_run(
    engine: &mut AgentEngine,
    user_input: &str,
    msg_id: &str,
) -> Result<(JsonValue, RunnableConfig), AgentError> {
    engine.cancel_flag.store(false, Ordering::SeqCst);
    *engine.has_error.lock().unwrap() = None;
    engine.current_msg_id = msg_id.to_string();
    engine.output.emit_stream_start(msg_id);

    log::info!("[engine] Starting run for msg_id={}, input_len={}", msg_id, user_input.len());

    // Update shared msg_id so nodes emit events with the right ID
    *engine.graph_msg_id.lock().unwrap() = msg_id.to_string();

    // Lazily build the graph once and reuse across turns
    if engine.graph.is_none() {
        let ctx = Arc::new(NodeContext {
            provider: Arc::clone(&engine.provider),
            tools: Arc::clone(&engine.tools),
            auto_approve: engine.auto_approve,
            allow_list: engine.allow_list.clone(),
            compact_config: engine.compact_config.clone(),
            plan_config: engine.plan_config.clone(),
            system_prompt: engine.system_prompt.clone(),
            max_tokens: engine.max_tokens,
            thinking: engine.thinking.clone(),
            compaction_level: engine.compaction_level,
            toon_enabled: engine.toon_enabled,
            max_turns: engine.max_turns,
            output: Arc::clone(&engine.output),
            msg_id: Arc::clone(&engine.graph_msg_id),
            session_id: engine.current_session.as_ref().map(|s| s.id.clone()),
            plan_active_flag: engine.plan_active_flag.clone(),
            debug_mode: engine.debug_mode,
            provider_label: engine.provider_label.clone(),
            has_error: Arc::clone(&engine.has_error),
            cancel_flag: Arc::clone(&engine.cancel_flag),
            approval_manager: engine.approval_manager.clone(),
            protocol_writer: engine.protocol_writer.clone(),
        });
        let app = build_agent_graph(ctx, Arc::clone(&engine.checkpointer))
            .map_err(|e| AgentError::ApiError(format!("Graph build error: {e}")))?;
        engine.graph = Some(app);
    }

    // Try parsing user_input as JSON
    let (parsed_text, attachments) = if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(user_input) {
        if let Some(obj) = json_val.as_object() {
            let text = obj.get("text").and_then(|v| v.as_str()).unwrap_or(user_input).to_string();
            let attachments: Option<Vec<UserAttachment>> = obj.get("attachments")
                .and_then(|v| serde_json::from_value(v.clone()).ok());
            (text, attachments)
        } else {
            (user_input.to_string(), None)
        }
    } else {
        (user_input.to_string(), None)
    };

    let session_id = engine.current_session.as_ref()
        .map(|s| s.id.clone())
        .unwrap_or_else(|| engine.thread_id.clone());

    let cwd = engine.current_session.as_ref()
        .map(|s| PathBuf::from(&s.cwd));

    let mut file_notices = String::new();

    if let Some(ref atts) = attachments {
        for att in atts {
            if att.kind == "file" {
                if let Some(ref data_b64) = att.data_base64 {
                    if let Ok(bytes) = decode_base64(data_b64) {
                        if let Some(ref cwd_path) = cwd {
                            let attachments_dir = cwd_path.join(".flock").join("attachments").join(&session_id);
                            if let Err(e) = std::fs::create_dir_all(&attachments_dir) {
                                log::error!("[engine] Failed to create attachments dir: {}", e);
                            }
                            let target_file_in_attachments = attachments_dir.join(&att.name);
                            if let Err(e) = std::fs::write(&target_file_in_attachments, &bytes) {
                                log::error!("[engine] Failed to write attachment file: {}", e);
                            }

                            let target_file_in_cwd = cwd_path.join(&att.name);
                            if let Err(e) = std::fs::write(&target_file_in_cwd, &bytes) {
                                log::error!("[engine] Failed to copy file to workspace root: {}", e);
                            } else {
                                log::info!("[engine] Successfully saved file {} to workspace root", att.name);
                            }
                        }
                    }
                }
                file_notices.push_str(&format!("[已上传工作空间文件: {}] (如果需要读取文件内容，请调用 Read 工具读取)\n", att.name));
            }
        }
    }

    let mut content_blocks = Vec::new();
    let mut text_content = parsed_text;
    if !file_notices.is_empty() {
        text_content = format!("{}{}", file_notices, text_content);
    }
    content_blocks.push(ContentBlock::Text { text: text_content });

    if let Some(ref atts) = attachments {
        for att in atts {
            if att.kind == "image" {
                if let Some(ref data_b64) = att.data_base64 {
                    let cleaned = clean_base64(data_b64).to_string();
                    content_blocks.push(ContentBlock::Image {
                        media_type: att.mime_type.clone(),
                        data: cleaned,
                    });
                }
            }
        }
    }

    // Build user message early to trigger instant auto-summary
    let new_user_msg_struct = Message::now(
        Role::User,
        content_blocks,
    );

    let is_first_turn = engine.messages.iter()
        .filter(|m| m.role == Role::User)
        .count() == 0;

    // Append user input immediately to local message cache to ensure it's saved on early abort
    engine.messages.push(new_user_msg_struct.clone());

    if is_first_turn {
        // log::info!("[summary] First turn detected. Saving user message and triggering immediate auto-summary.");
        engine.save_session().await;
    }

    let new_user_msg = serde_json::to_value(&new_user_msg_struct)
        .map_err(|e| AgentError::ApiError(format!("Serialise user msg: {e}")))?;
    log::debug!("[engine] Created new user message for graph");

    let initial_state = AgentState::from_engine_snapshot(
        engine.model.clone(),
        engine.current_reasoning_effort.clone(),
        &engine.total_usage,
        engine.compact_state.last_input_tokens.max(engine.total_usage.input_tokens),
        engine.turns,
        engine.allow_list.clone(),
        engine.plan_state.is_active,
        engine.plan_state.pre_plan_allow_list.clone(),
        vec![new_user_msg],
    );

    let initial_json = serde_json::to_value(&initial_state)
        .map_err(|e| AgentError::ApiError(format!("State serialisation error: {e}")))?;

    // Config: use fixed thread_id for this engine instance
    let mut config = RunnableConfig::new();
    config.insert(
        "configurable".to_string(),
        serde_json::json!({ "thread_id": &engine.thread_id }),
    );

    Ok((initial_json, config))
}

impl AgentEngine {
    /// Run the agent graph by consuming a single astream loop with unidirectional persistence
    pub async fn run(&mut self, user_input: &str, msg_id: &str) -> Result<AgentResult, AgentError> {
        let (initial_json, config) = prepare_run(self, user_input, msg_id).await?;

        let mut stream = self.graph.as_ref().unwrap().astream(
            &initial_json,
            &config,
            vec![StreamMode::Updates, StreamMode::Custom]
        );

        while let Some(part_res) = stream.next().await {
            // Check if execution was canceled
            if self.cancel_flag.load(Ordering::Relaxed) {
                self.output.emit_info("[engine] cancel_flag is set during stream, aborting run");
                self.sync_and_save_session(&config).await;
                return Err(AgentError::UserAborted);
            }

            if let StreamMode::Custom = part_res.mode {
                if let Some(event) = part_res.data.get("event").and_then(|v| v.as_str()) {
                    if event == "on_chat_model_stream" {
                        let type_str = part_res.data.get("type").and_then(|v| v.as_str()).unwrap_or("content");
                        if let Some(chunk) = part_res.data.get("chunk").and_then(|v| v.as_str()) {
                            if type_str == "thinking" {
                                self.output.emit_thinking(chunk, msg_id);
                            } else {
                                self.output.emit_text_delta(chunk, msg_id);
                            }
                        }
                    }
                }
            }
        }

        // Stream completed, check if any internal error was raised (like user cancellation in FlockToolNode)
        let err_opt = self.has_error.lock().unwrap().clone();
        if let Some(err) = err_opt {
            self.output.emit_info(&format!("[engine] error detected in node context: {}", err));
            self.sync_and_save_session(&config).await;
            if err == "UserAborted" {
                return Err(AgentError::UserAborted);
            } else {
                return Err(AgentError::Provider(err));
            }
        }

        // Execution succeeded. Retrieve the final state snapshot to sync metadata and save messages
        let snapshot = self.graph.as_ref().unwrap()
            .get_state(&config)
            .map_err(|e| AgentError::ApiError(e.to_string()))?;

        let graph_state: AgentState = serde_json::from_value(snapshot.values.clone()).unwrap_or_default();
        
        // Retrieve the last messages from the graph state
        if let Some(msgs_array) = snapshot.values.get("messages").and_then(|v| v.as_array()) {
            let final_msgs: Vec<Message> = msgs_array
                .iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect();

            // Smoothly append/update the final Assistant response to memory messages
            if let Some(graph_last) = final_msgs.last() {
                if graph_last.role == Role::Assistant {
                    let already_has = self.messages.last().map(|m| m.role == Role::Assistant).unwrap_or(false);
                    if !already_has {
                        log::info!("[engine] Appending new AI assistant reply to memory messages");
                        self.messages.push(graph_last.clone());
                    } else if let Some(last_msg) = self.messages.last_mut() {
                        last_msg.content = graph_last.content.clone();
                    }
                }
            }
        }

        // Sync metadata states
        let new_usage = graph_state.to_token_usage();
        self.total_usage = new_usage.clone();
        self.compact_state.last_input_tokens = graph_state.last_input_tokens;
        self.compact_state.consecutive_failures = graph_state.compact_consecutive_failures;
        self.turns = graph_state.turns as usize;

        if !graph_state.model.is_empty() {
            self.model = graph_state.model.clone();
        }
        self.current_reasoning_effort = graph_state.reasoning_effort.clone();
        self.allow_list = graph_state.allow_list.clone();
        self.plan_state.is_active = graph_state.plan_mode_active;
        self.plan_state.pre_plan_allow_list = graph_state.pre_plan_allow_list.clone();

        if let Some(ref flag) = self.plan_active_flag {
            flag.store(
                graph_state.plan_mode_active,
                Ordering::Release,
            );
        }

        // Extract the final assistant text block to return in result
        let final_text = self
            .messages
            .iter()
            .rev()
            .find_map(|m| {
                if m.role == Role::Assistant {
                    m.content.iter().find_map(|c| {
                        if let ContentBlock::Text { text } = c {
                            Some(text.clone())
                        } else {
                            None
                        }
                    })
                } else {
                    None
                }
            })
            .unwrap_or_default();

        self.save_session().await;

        self.output.emit_stream_end(
            msg_id,
            graph_state.turns as usize,
            new_usage.input_tokens,
            new_usage.output_tokens,
            new_usage.cache_creation_tokens,
            new_usage.cache_read_tokens,
        );

        Ok(AgentResult {
            text: final_text,
            stop_reason: StopReason::EndTurn,
            usage: new_usage,
            turns: graph_state.turns as usize,
        })
    }
}
