use std::sync::Arc;
use langgraph_prebuilt::BaseChatModel;
use flock_core::types::message::{ContentBlock, Message, Role};

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct DbModelConfig {
    provider: String,
    model: Option<String>,
}

pub async fn run_background_summary(
    db: Arc<flock_core::db::DbManager>,
    thread_id: String,
    messages: Vec<Message>,
    default_provider: Arc<dyn BaseChatModel>,
    protocol_writer: Option<Arc<dyn flock_core::ipc_interface::writer::ProtocolEmitter>>,
) -> anyhow::Result<()> {
    // log::info!("[summary] Starting background auto-summary task for thread: {}", thread_id);

    // 1. Fetch existing summary to check if it's already customized
    let existing_sum: Option<String> = sqlx::query_scalar(
        "SELECT summary FROM session_metadata WHERE thread_id = ?1"
    )
    .bind(&thread_id)
    .fetch_optional(db.pool())
    .await
    .unwrap_or(None);

    let existing_sum = existing_sum.unwrap_or_default();
    // log::info!("[summary] Current thread summary in DB: {:?}", existing_sum);

    // Generate a default summary (first user message truncated)
    let default_sum = messages
        .iter()
        .find(|m| m.role == Role::User)
        .and_then(|m| {
            m.content.iter().find_map(|c| {
                if let ContentBlock::Text { text } = c {
                    let mut s = text.clone();
                    if s.chars().count() > 80 {
                        let truncated: String = s.chars().take(77).collect();
                        s = format!("{}...", truncated);
                    }
                    Some(s)
                } else {
                    None
                }
            })
        })
        .unwrap_or_default();

    // If it's already customized (not empty, not a placeholder, and not equal to the default
    // message-based fallback), do nothing. Placeholder titles like "对话 1779024059" or
    // "Session conv_..." are created by create_conversation() and should still be overwritten
    // by the AI-generated summary.
    if !existing_sum.is_empty() && existing_sum != default_sum && !is_placeholder_title(&existing_sum) {
        log::info!("[summary] Thread summary has already been customized. Skipping auto-summary.");
        return Ok(());
    }

    // 2. Fetch the summary model configuration from app_config
    let summary_cfg_val: Option<serde_json::Value> = db.get_config("summary_model").await;
    log::info!("[summary] Loaded summary_model config: {:?}", summary_cfg_val);
    
    let mut use_custom_provider = false;
    let mut summary_provider: Option<Box<dyn BaseChatModel>> = None;

    if let Some(val) = summary_cfg_val {
        if let (Some(provider_id), Some(model_name)) = (
            val.get("provider").and_then(|v| v.as_str()),
            val.get("model").and_then(|v| v.as_str()),
        ) {
            if provider_id != "follow" {
                log::info!("[summary] Initializing custom summary model: provider={}, model={}", provider_id, model_name);
                // Load provider credentials
                if let Some(p) = db.get_provider(provider_id).await.unwrap_or(None) {
                    let params = flock_core::model_factory::ModelProviderParams {
                        provider_type: p.provider_type,
                        model: model_name.to_string(),
                        api_key: p.api_key.unwrap_or_default(),
                        base_url: p.base_url,
                        max_tokens: None,
                        temperature: None,
                        top_p: None,
                        frequency_penalty: None,
                        presence_penalty: None,
                        response_format: None,
                    };
                    if let Ok(m) = flock_core::model_factory::create_model(params) {
                        summary_provider = Some(m);
                        use_custom_provider = true;
                        log::info!("[summary] Custom summary model initialized successfully");
                    } else {
                        log::warn!("[summary] Failed to create custom model; falling back to default provider");
                    }
                } else {
                    log::warn!("[summary] Custom provider credentials not found; falling back to default provider");
                }
            }
        }
    }

    // 3. Construct user prompt for summary
    let first_user_query = messages
        .iter()
        .find(|m| m.role == Role::User)
        .and_then(|m| {
            m.content.iter().find_map(|c| {
                if let ContentBlock::Text { text } = c {
                    Some(text.as_str())
                } else {
                    None
                }
            })
        })
        .unwrap_or("");

    if first_user_query.is_empty() {
        log::info!("[summary] First user query is empty. Skipping auto-summary.");
        return Ok(());
    }

    let summary_prompt = format!(
        "请为以下用户的对话首条提问总结一个非常简短的主题（原则上不超过10个字，用中文，不要包含任何标点符号、引号、括号或多余修饰）：\n\n\"{}\"",
        first_user_query
    );

    // Construct standard flock Message list first (existing unified pattern)
    let messages_for_llm = vec![
        Message::new(
            Role::System,
            vec![ContentBlock::Text {
                text: "你是一个对话主题总结助手。请直接输出这笔对话的最简短主题，不要有任何多余的标点符号或前缀解释。".to_string(),
            }],
        ),
        Message::new(
            Role::User,
            vec![ContentBlock::Text {
                text: summary_prompt,
            }],
        ),
    ];

    // Convert via existing to_langgraph_message helper to ensure decoupling from concrete model types
    let conv_messages: Vec<langgraph_prebuilt::types::Message> = messages_for_llm
        .into_iter()
        .map(crate::graph::to_langgraph_message)
        .collect();

    let runnable_config = langgraph_checkpoint::config::RunnableConfig::new();

    // 4. Run LLM call using streaming (astream) to robustly collect content and bypass non-streaming gateway bugs
    let response_text = if use_custom_provider {
        if let Some(provider) = summary_provider {
            use tokio_stream::StreamExt;
            let mut rx = provider.astream(&conv_messages[..], &runnable_config);
            let mut text = String::new();
            let mut thinking = String::new();
            while let Some(msg_res) = rx.next().await {
                match msg_res {
                    Ok(msg) => {
                        if let Some(chunk) = msg.text() {
                            text.push_str(chunk);
                        }
                        if let Some(think) = msg.thinking() {
                            thinking.push_str(think);
                        }
                    }
                    Err(e) => {
                        log::warn!("[summary] Custom summary model stream chunk error: {}", e);
                    }
                }
            }
            log::info!("[summary] Custom model stream finished. Text: {:?}, Thinking: {:?}", text, thinking);

            if text.trim().is_empty() && !thinking.trim().is_empty() {
                log::info!("[summary] Custom model text was empty but thinking was not. Falling back to thinking content!");
                text = thinking;
            }

            if !text.trim().is_empty() {
                text
            } else {
                log::warn!("[summary] Custom summary model call yielded empty response. Falling back to default provider.");
                log::info!("[summary] Invoking default provider as fallback using astream...");
                let mut rx = default_provider.astream(&conv_messages[..], &runnable_config);
                let mut text = String::new();
                while let Some(msg_res) = rx.next().await {
                    if let Ok(msg) = msg_res {
                        if let Some(chunk) = msg.text() {
                            text.push_str(chunk);
                        }
                    }
                }
                text
            }
        } else {
            return Err(anyhow::anyhow!("Custom provider was flagged but could not be initialized"));
        }
    } else {
        // Follow default provider
        log::info!("[summary] Invoking default provider using astream...");
        use tokio_stream::StreamExt;
        let mut rx = default_provider.astream(&conv_messages[..], &runnable_config);
        let mut text = String::new();
        while let Some(msg_res) = rx.next().await {
            if let Ok(msg) = msg_res {
                if let Some(chunk) = msg.text() {
                    text.push_str(chunk);
                }
            }
        }
        text
    };

    // 5. Clean up response text
    let mut clean_title = response_text
        .trim()
        .replace(['\"', '“', '”', '`', '\'', '「', '」', '《', '》', '【', '】', '：', ':', '。', '.', '！', '!', '？', '?'], "");
        
    if clean_title.chars().count() > 10 {
        clean_title = clean_title.chars().take(8).collect::<String>() + "...";
    }

    log::info!("[summary] Cleaned title result: {:?}", clean_title);

    if !clean_title.is_empty() {
        // Update database
        log::info!("[summary] Writing summary title to database for thread {}", thread_id);
        db.update_conversation_title(&thread_id, &clean_title).await?;
        
        // Emit TitleUpdated event through protocol writer
        if let Some(writer) = protocol_writer {
            log::info!("[summary] Emitting TitleUpdated event for thread {}", thread_id);
            let _ = writer.emit(&flock_core::ipc_interface::events::ProtocolEvent::TitleUpdated {
                thread_id: thread_id.clone(),
                title: clean_title.clone(),
            });
        }
    }

    log::info!("[summary] Background auto-summary completed successfully for thread: {}", thread_id);
    Ok(())
}

/// Determine whether a summary string is an auto-generated placeholder title
/// (as opposed to a user-edited or AI-generated title that should be preserved).
///
/// Placeholder patterns come from `create_conversation()` in conversations.rs:
///   - "对话 <digits>"    e.g. "对话 1779024059"
///   - "Session <id>"    e.g. "Session conv_1779024059"  (list_workspace_sessions fallback)
pub fn is_placeholder_title(s: &str) -> bool {
    let s = s.trim();
    if s.starts_with("对话") {
        let rest = s.strip_prefix("对话").unwrap().trim();
        if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
            return true;
        }
    }
    if s.starts_with("Session") {
        let rest = s.strip_prefix("Session").unwrap().trim();
        if !rest.is_empty() && (rest.chars().all(|c| c.is_ascii_digit() || c == '_' || c == '-') || rest.starts_with("conv_")) {
            return true;
        }
    }
    false
}
