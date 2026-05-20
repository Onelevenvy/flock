use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string};

pub fn make_parameter_extractor_node(
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
            let instruction = node_data.get("instruction").and_then(|v| v.as_str()).unwrap_or("");

            let parameters_raw = node_data.get("parameters").and_then(|v| v.as_array());
            let mut params_desc = Vec::new();
            if let Some(arr) = parameters_raw {
                for item in arr {
                    let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let ptype = item.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                    let desc = item.get("description").and_then(|v| v.as_str()).unwrap_or("");
                    let req = item.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
                    params_desc.push(format!("- {}: type={}, description={}, required={}", name, ptype, desc, req));
                }
            }

            let sys_prompt = format!(
                "You are a structured extraction assistant.\n\
                 Extract the parameters described below from the user's input text according to the instructions.\n\
                 Respond with ONLY a single, valid JSON object containing the extracted key-value pairs, and nothing else. Do NOT wrap it in code block markdown or quotes.\n\n\
                 Parameters to extract:\n{}\n\n\
                 Instructions:\n{}",
                params_desc.join("\n"),
                instruction
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

            let cleaned_json = assistant_text.trim().trim_matches('`').trim_start_matches("json").trim().to_string();
            let parsed_json: JsonValue = serde_json::from_str(&cleaned_json).unwrap_or_else(|_| {
                json!({ "raw_response": assistant_text })
            });

            ctx.sink.emit_text_delta(&node_id, &format!("参数提取结果:\n```json\n{}\n```\n", serde_json::to_string_pretty(&parsed_json).unwrap_or_default()));

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "parameters": parsed_json
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
