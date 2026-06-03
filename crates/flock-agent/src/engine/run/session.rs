use std::sync::atomic::Ordering;
use std::sync::Arc;
use langgraph::prelude::RunnableConfig;
use flock_core::types::message::{ContentBlock, Message, Role, TokenUsage};
use crate::session::Session;
use crate::engine::AgentEngine;

impl AgentEngine {
    /// Initialize a new session for this engine run
    pub async fn init_session(
        &mut self,
        provider_name: &str,
        cwd: &str,
        session_id: Option<&str>,
    ) -> anyhow::Result<()> {
        if let Some(mgr) = &self.session_manager {
            match session_id {
                Some(sid) => {
                    let now = chrono::Utc::now();
                    self.current_session = Some(Session {
                        id: sid.to_string(),
                        created_at: now,
                        updated_at: now,
                        provider: provider_name.to_string(),
                        model: self.model.clone(),
                        cwd: cwd.to_string(),
                        total_usage: TokenUsage::default(),
                        messages: Vec::new(),
                    });
                    self.thread_id = sid.to_string(); // 🚀 Keep thread_id in sync!
                }
                None => {
                    let sid = uuid::Uuid::new_v4().to_string();
                    let now = chrono::Utc::now();
                    self.current_session = Some(Session {
                        id: sid.clone(),
                        created_at: now,
                        updated_at: now,
                        provider: provider_name.to_string(),
                        model: self.model.clone(),
                        cwd: cwd.to_string(),
                        total_usage: TokenUsage::default(),
                        messages: Vec::new(),
                    });
                    self.thread_id = sid; // 🚀 Keep thread_id in sync!
                }
            }
        }
        Ok(())
    }

    pub(crate) async fn save_session(&mut self) {
        if let (Some(mgr), Some(session)) = (&self.session_manager, &mut self.current_session) {
            session.messages = self.messages.clone();
            session.total_usage = self.total_usage.clone();
            session.updated_at = chrono::Utc::now();
            match mgr.save_metadata(session).await {
                Ok(Some(new_title)) => {
                    // log::info!("[summary] Session title updated in database to fallback: {}", new_title);
                    if let Some(ref writer) = self.protocol_writer {
                        // log::info!("[summary] Emitting instant fallback TitleUpdated event for thread {}", session.id);
                        let _ = writer.emit(&flock_core::ipc_interface::events::ProtocolEvent::TitleUpdated {
                            thread_id: session.id.clone(),
                            title: new_title,
                        });
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    self.output
                        .emit_error(&format!("Failed to save session metadata: {}", e));
                }
            }

            // Trigger AI topic summary asynchronously on first user-assistant turn (exactly 1 user message in history)
            let user_msg_count = session.messages.iter()
                .filter(|m| m.role == flock_core::types::message::Role::User)
                .count();
            if user_msg_count == 1 {
                if let Some(db) = &self.db_manager {
                    let db = db.clone();
                    let thread_id = session.id.clone();
                    let messages = session.messages.clone();
                    let default_provider = self.provider.clone();
                    let protocol_writer = self.protocol_writer.clone();

                    tokio::spawn(async move {
                        let enable_summary: Option<bool> = db.get_config("enable_title_summary").await;
                        if enable_summary.unwrap_or(false) {
                            if let Err(e) = crate::engine::summary::run_background_summary(db, thread_id, messages, default_provider, protocol_writer).await {
                                eprintln!("[summary] Background auto summary failed: {}", e);
                            }
                        } else {
                            log::info!("[summary] Chat list title summary is disabled, skipping auto-summary.");
                        }
                    });
                }
            }
        }
    }

    pub(crate) async fn sync_and_save_session(
        &mut self,
        config: &langgraph::prelude::RunnableConfig,
    ) {
        use crate::graph::AgentState;
        use flock_core::types::message::Message;

        let snapshot_res = {
            let app = self.graph.as_ref().unwrap();
            app.get_state(config)
        };

        if let Ok(snapshot) = snapshot_res {
            let mut msgs: Vec<Message> = Vec::new();
            if let Some(msgs_array) = snapshot.values.get("messages").and_then(|v| v.as_array()) {
                msgs = msgs_array
                    .iter()
                    .filter_map(|v| serde_json::from_value(v.clone()).ok())
                    .collect();
            }

            // 重点防御：如果快照里拿到的消息长度，比我们内存现存的 self.messages 还少（说明快照还没来得及更新或发生了秒掐回滚）
            // 我们保留更丰富、包含了最新用户输入的 self.messages，而不使用倒退的快照覆盖
            if msgs.len() < self.messages.len() {
                msgs = self.messages.clone();
            }

            self.messages = msgs;

            let graph_state: AgentState =
                serde_json::from_value(snapshot.values.clone()).unwrap_or_default();
            self.total_usage = graph_state.to_token_usage();
            self.compact_state.last_input_tokens = graph_state.last_input_tokens;
            
            self.save_session().await;
        }
    }
}
