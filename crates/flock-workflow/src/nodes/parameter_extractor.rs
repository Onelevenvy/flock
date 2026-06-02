use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use tokio_stream::StreamExt;
use langgraph_prebuilt::types::Message as LgMessage;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context, resolve_model, parse_retry_config, parse_timeout_config, execute_with_retry};

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
                    let instruction = node_data.get("instruction").and_then(|v| v.as_str()).unwrap_or("");

                    let parameters_raw = node_data.get("parameters").and_then(|v| v.as_array());
                    let mut schema_obj = serde_json::Map::new();
                    if let Some(arr) = parameters_raw {
                        for item in arr {
                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                if !name.is_empty() {
                                    let mut param_details = serde_json::Map::new();
                                    let ptype = item.get("type").and_then(|v| v.as_str()).unwrap_or("string");
                                    let desc = item.get("description").and_then(|v| v.as_str()).unwrap_or("");
                                    let req = item.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
                                    param_details.insert("type".to_string(), json!(ptype));
                                    param_details.insert("required".to_string(), json!(req));
                                    param_details.insert("description".to_string(), json!(desc));
                                    schema_obj.insert(name.to_string(), json!(param_details));
                                }
                            }
                        }
                    }
                    let parameter_schema_str = serde_json::to_string_pretty(&schema_obj).unwrap_or_default();

                    let sys_prompt = format!(
                        "You are a helpful assistant tasked with extracting structured information based on specific criteria provided. Follow the guidelines below to ensure consistency and accuracy.\n\n\
                         ### Task\n\
                         Always extract parameters from the input text according to the provided schema. Your output must be a valid JSON object that matches the schema requirements.\n\n\
                         ### Instructions\n\
                         Some additional information is provided below. Always adhere to these instructions as closely as possible:\n\
                         <instruction>\n\
                         {}\n\
                         </instruction>\n\n\
                         Steps:\n\
                         1. Review the input text carefully and understand the schema requirements\n\
                         2. Extract relevant parameters based on the schema definition\n\
                         3. Ensure extracted values match the required data types\n\
                         4. Generate a well-formatted JSON output\n\
                         5. Do not include any explanations or additional text in the output\n\
                         6. Return ONLY the JSON object, no XML tags in the output\n\n\
                         ### Structure\n\
                         Here is the structure of the expected output, you MUST always follow this output structure:\n\
                         {{\n\
                             \"parameter_name1\": \"value matching schema type\",\n\
                             \"parameter_name2\": \"value matching schema type\",\n\
                             ...\n\
                         }}\n\
                         The output must:\n\
                         1. Contain all required parameters defined in the schema\n\
                         2. Match the exact data types specified in the schema\n\
                         3. Be a valid JSON object without any additional text or XML tags\n\
                         4. Follow the exact parameter names from the schema\n\n\
                         ### Example Output\n\
                         To illustrate, here are some examples of valid parameter extraction:\n\
                         <example>\n\
                         Input: {{\"text\": \"Book a flight from NYC to London on July 15th\", \"schema\": {{\"departure\": {{\"type\": \"string\", \"required\": true, \"description\": \"The departure city\"}}, \"destination\": {{\"type\": \"string\", \"required\": true, \"description\": \"The destination city\"}}, \"date\": {{\"type\": \"string\", \"required\": true, \"description\": \"The date of the flight\"}}}}}}\n\
                         Output: {{\"departure\": \"NYC\", \"destination\": \"London\", \"date\": \"July 15th\"}}\n\n\
                         Input: {{\"text\": \"Room temperature is 23.5°C with 45 percent humidity\", \"schema\": {{\"temperature\": {{\"type\": \"number\", \"required\": true, \"description\": \"The temperature in degrees Celsius\"}}, \"humidity\": {{\"type\": \"number\", \"required\": true, \"description\": \"The humidity in percent\"}}}}}}\n\
                         Output: {{\"temperature\": 23.5, \"humidity\": 45}}\n\
                         </example>\n\n\
                         ### Final Output\n\
                         Produce well-formatted JSON object without XML tags, strictly following the schema structure.",
                        instruction
                    );

                    let user_prompt = format!(
                        "Extract structured parameters from the input text inside <text></text> XML tags according to the schema inside <schema></schema> XML tags.\n\n\
                         ### Input Text\n\
                         <text>\n\
                         {}\n\
                         </text>\n\n\
                         ### Parameter Schema\n\
                         <schema>\n\
                         {}\n\
                         </schema>\n\n\
                         ### Task\n\
                         1. Extract all required parameters from the input text\n\
                         2. Format them according to the schema definition\n\
                         3. Return only a valid JSON object containing the extracted parameters\n\
                         4. Do not include any explanations or XML tags in the output",
                        input_val,
                        parameter_schema_str
                    );

                    let messages = vec![
                        LgMessage::system(sys_prompt),
                        LgMessage::human(user_prompt),
                    ];

                    let model = resolve_model(&node_data, &ctx);
                    let mut rx = model.astream(&messages[..], &config);
                    let mut assistant_text = String::new();

                    while let Some(msg_res) = rx.next().await {
                        let msg = msg_res.map_err(|e| format!("{}", e))?;
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

                    Ok::<JsonValue, String>(json!({
                        "node_outputs": outputs,
                        "current_node": node_id,
                    }))
                }
            }).await;

            result.map_err(|e| RunnableError::Node(e))
        })
    }
}
