use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string};

struct CategoryItem {
    id: String,
    name: String,
}

pub fn make_classifier_node(
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
            let state = parse_state(&input);

            let input_val_template = node_data.get("input").and_then(|v| v.as_str()).unwrap_or("");
            let input_val = interpolate_string(input_val_template, &state);

            let categories_raw = node_data.get("categories").and_then(|v| v.as_array());
            let mut categories = Vec::new();
            if let Some(arr) = categories_raw {
                for item in arr {
                    let id = item.get("category_id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    let name = item.get("category_name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    if !id.is_empty() {
                        categories.push(CategoryItem { id, name });
                    }
                }
            }

            if categories.is_empty() {
                return Err(RunnableError::Node("Classifier node requires categories".to_string()));
            }

            let categories_desc = categories.iter()
                .map(|c| format!("- {} (name: {})", c.id, c.name))
                .collect::<Vec<_>>()
                .join("\n");

            let sys_prompt = format!(
                "You are a classification assistant. Your task is to classify the user's input into exactly one of the following categories.\n\
                 Respond with ONLY the exact category_id of the matching category, and nothing else. Do NOT include any code blocks, markdown, quotes, punctuation or extra text.\n\n\
                 Categories:\n{}",
                categories_desc
            );

            let messages = vec![
                LgMessage::system(sys_prompt),
                LgMessage::human(input_val),
            ];

            let mut rx = ctx.provider.astream(&messages[..], &config);
            let mut assistant_text = String::new();

            while let Some(msg_res) = rx.next().await {
                let msg = msg_res.map_err(|e| RunnableError::Node(e.to_string()))?;
                if let Some(content) = msg.text() {
                    if !content.is_empty() {
                        assistant_text.push_str(content);
                    }
                }
            }

            let matched_id = assistant_text.trim().trim_matches('"').trim_matches('\'').trim().to_string();
            let final_matched_id = if categories.iter().any(|c| c.id == matched_id) {
                matched_id
            } else {
                // Try fuzzy or fallback to the last category
                categories.last().map(|c| c.id.clone()).unwrap_or_default()
            };

            ctx.sink.emit_text_delta(&node_id, &format!("意图分类结果: `{}`", final_matched_id));

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "category_id": final_matched_id
            });
            outputs[&node_id] = node_output.clone();

            ctx.sink.emit_node_done(&node_id, &node_output);

            Ok(json!({
                "node_outputs": outputs,
                "current_node": node_id,
            }))
        })
    }
}
