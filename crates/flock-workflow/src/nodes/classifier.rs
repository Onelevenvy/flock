use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph::prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context, resolve_model, parse_retry_config, parse_timeout_config, execute_with_retry};

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

                    let input_val_template = node_data.get("input").and_then(|v| v.as_str()).unwrap_or("");
                    let input_val = interpolate_string_with_context(input_val_template, &state, &ctx, &ctx.workflow_id);

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
                        return Err("Classifier node requires categories".to_string());
                    }

                    let categories_names = categories.iter()
                        .map(|c| format!("\"{}\"", c.name))
                        .collect::<Vec<_>>()
                        .join(", ");

                    let sys_prompt = r#"### Job Description
You are a text classification engine that analyzes text data and assigns categories based on user input.

### Task
Your task is to assign exactly ONE category from the provided categories list to the input text. Additionally, you need to extract the key words from the text that are related to the classification.

### Constraint
You MUST respond with a valid JSON object only. Do NOT include any markdown, code blocks (such as ```json), HTML tags, or extra text outside the JSON.

### Format
Output format must be a JSON object like:
{
  "keywords": ["keyword1", "keyword2"],
  "category_name": "selected_category_name"
}

### Example
User:
{
  "input_text": "I recently had a great experience with your company. The service was prompt and the staff was very friendly.",
  "categories": ["Customer Service", "Satisfaction", "Sales", "Product"]
}
Assistant:
{
  "keywords": ["recently", "great experience", "service", "prompt", "friendly"],
  "category_name": "Customer Service"
}"#.to_string();

                    let user_prompt = format!(
                        "### Input\n\
                         input_text: \"{}\"\n\
                         categories: [{}]\n\n\
                         ### Assistant Output\n\
                         Please classify the above input_text into exactly one of the listed categories.\n\
                         Return the JSON object only.",
                        input_val,
                        categories_names
                    );

                    let messages = vec![
                        LgMessage::system(sys_prompt),
                        LgMessage::human(user_prompt),
                    ];

                    ctx.sink.emit_text_delta(&node_id, "\u{200b}");

                    let model = resolve_model(&node_data, &ctx);
                    let mut rx = model.astream(&messages[..], &config);
                    let mut assistant_text = String::new();

                    while let Some(msg_res) = rx.next().await {
                        if ctx.cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                            return Err("Workflow execution cancelled by user".to_string());
                        }
                        let msg = msg_res.map_err(|e| format!("{}", e))?;
                        if let Some(thinking) = msg.thinking() {
                            if !thinking.is_empty() {
                                ctx.sink.emit_thinking(&node_id, thinking);
                            }
                        }
                        if let Some(content) = msg.text() {
                            if !content.is_empty() {
                                assistant_text.push_str(content);
                            }
                        }
                    }

                    let assistant_text_trimmed = assistant_text.trim();
                    let mut matched_name = String::new();

                    // 1. Try to parse JSON output
                    let parsed_json: Option<serde_json::Value> = serde_json::from_str(assistant_text_trimmed)
                        .ok()
                        .or_else(|| {
                            // Fallback cleanup if model wraps output in markdown code blocks
                            let clean_text = assistant_text_trimmed
                                .trim_start_matches("```json")
                                .trim_start_matches("```")
                                .trim_end_matches("```")
                                .trim();
                            serde_json::from_str(clean_text).ok()
                        });

                    if let Some(json_val) = parsed_json {
                        if let Some(cat_name) = json_val.get("category_name").and_then(|v| v.as_str()) {
                            matched_name = cat_name.trim().to_string();
                        }
                    }

                    // 2. Perform robust matching to find the category ID
                    let final_matched_id = if !matched_name.is_empty() {
                        if let Some(found_cat) = categories.iter().find(|c| c.name.eq_ignore_ascii_case(&matched_name)) {
                            found_cat.id.clone()
                        } else if let Some(found_cat) = categories.iter().find(|c| {
                            c.name.to_lowercase().contains(&matched_name.to_lowercase()) || 
                            matched_name.to_lowercase().contains(&c.name.to_lowercase())
                        }) {
                            found_cat.id.clone()
                        } else {
                            categories.iter()
                                .find(|c| c.id == "others_category")
                                .map(|c| c.id.clone())
                                .unwrap_or_else(|| categories.last().map(|c| c.id.clone()).unwrap_or_default())
                        }
                    } else {
                        // Fallback: search for category names directly in raw output text
                        if let Some(found_cat) = categories.iter().find(|c| assistant_text.contains(&c.name)) {
                            found_cat.id.clone()
                        } else {
                            categories.iter()
                                .find(|c| c.id == "others_category")
                                .map(|c| c.id.clone())
                                .unwrap_or_else(|| categories.last().map(|c| c.id.clone()).unwrap_or_default())
                        }
                    };

                    let display_name = categories.iter()
                        .find(|c| c.id == final_matched_id)
                        .map(|c| c.name.as_str())
                        .unwrap_or("未知");
                    ctx.sink.emit_text_delta(&node_id, &format!("Classified category: `{}`\n", display_name));

                    let mut outputs = state.node_outputs.clone();
                    if !outputs.is_object() {
                        outputs = json!({});
                    }
                    let node_output = json!({
                        "category_id": final_matched_id
                    });
                    outputs[&node_id] = node_output.clone();

                    ctx.sink.emit_node_done(&node_id, &node_output);

                    Ok::<JsonValue, String>(json!({
                        "node_outputs": outputs,
                        "current_node": node_id,
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
