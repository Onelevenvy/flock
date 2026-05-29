use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context, parse_retry_config, parse_timeout_config, execute_with_retry};

pub fn make_code_node(
    node_id: String,
    node_data: JsonValue,
    ctx: Arc<WorkflowNodeContext>,
) -> impl Fn(JsonValue, RunnableConfig) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<JsonValue, RunnableError>> + Send>>
       + Send
       + Sync
       + 'static {
    move |input: JsonValue, _config: RunnableConfig| {
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
                async move {
                    let state = parse_state(&input);

                    let raw_code = node_data.get("code").and_then(|v| v.as_str()).unwrap_or("");
                    let interpolated_code = interpolate_string_with_context(raw_code, &state, &ctx, &ctx.workflow_id);
                    let language = node_data.get("language").and_then(|v| v.as_str()).unwrap_or("python");

                    ctx.sink.emit_text_delta(&node_id, &format!("*⚙️ 执行 {} 代码...*\n", language));

                    let (cmd, ext) = match language {
                        "javascript" | "js" => ("node", "js"),
                        _ => ("python", "py"),
                    };

                    let scratch_dir = std::env::current_dir().unwrap_or_default().join(".gemini-scratch");
                    std::fs::create_dir_all(&scratch_dir).ok();
                    let file_path = scratch_dir.join(format!("wf_code_{}.{}", node_id, ext));
                    if let Err(e) = std::fs::write(&file_path, &interpolated_code) {
                        return Err(format!("Failed to write code file: {}", e));
                    }

                    let exec_res = tokio::process::Command::new(cmd)
                        .arg(&file_path)
                        .output()
                        .await;

                    let output_text = match exec_res {
                        Ok(out) => {
                            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                            if !stderr.is_empty() {
                                format!("Stdout:\n{}\n\nStderr:\n{}", stdout, stderr)
                            } else {
                                stdout
                            }
                        }
                        Err(e) => format!("Execution failed: {}", e),
                    };

                    ctx.sink.emit_text_delta(&node_id, &format!("\n```\n{}\n```\n", output_text));

                    let mut outputs = state.node_outputs.clone();
                    if !outputs.is_object() {
                        outputs = json!({});
                    }
                    let node_output = json!({
                        "response": output_text
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
