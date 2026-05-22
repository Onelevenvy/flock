use std::sync::atomic::Ordering;
use langgraph::prelude::RunnableConfig;
use langgraph::types::StreamMode;
use tokio_stream::StreamExt;
use serde_json::Value as JsonValue;
use crate::engine::{AgentEngine, AgentError};

pub async fn run_stream(
    engine: &mut AgentEngine,
    current_input: &JsonValue,
    config: &RunnableConfig,
    msg_id: &str,
) -> Result<(), AgentError> {
    let mut stream = engine.graph.as_ref().unwrap().astream(
        current_input,
        config,
        vec![StreamMode::Updates, StreamMode::Custom]
    );

    let mut cancelled = false;
    loop {
        tokio::select! {
            _ = async {
                loop {
                    if engine.cancel_flag.load(Ordering::Relaxed) {
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                }
            } => {
                cancelled = true;
                break;
            }
            part_opt = stream.next() => {
                if let Some(part) = part_opt {
                    match part.mode {
                        StreamMode::Custom => {
                            if let Some(event) = part.data.get("event").and_then(|v| v.as_str()) {
                                if event == "on_chat_model_stream" {
                                    let type_str = part.data.get("type").and_then(|v| v.as_str()).unwrap_or("content");
                                    if let Some(chunk) = part.data.get("chunk").and_then(|v| v.as_str()) {
                                        if type_str == "thinking" {
                                            engine.output.emit_thinking(chunk, msg_id);
                                        } else {
                                            engine.output.emit_text_delta(chunk, msg_id);
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                } else {
                    break;
                }
            }
        }
    }

    if cancelled {
        engine.output.emit_info("[engine] cancel_flag is set during stream, aborting run");
        engine.sync_and_save_session(config).await;
        return Err(AgentError::UserAborted);
    }

    Ok(())
}
