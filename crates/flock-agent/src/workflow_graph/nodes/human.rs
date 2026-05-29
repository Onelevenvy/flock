use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string_with_context};

pub fn make_human_node(
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
            let state = parse_state(&input);

            let title_template = node_data.get("form_content")
                .or_else(|| node_data.get("title"))
                .and_then(|v| v.as_str())
                .unwrap_or("Waiting for review");
            let title = interpolate_string_with_context(title_template, &state, &ctx, &ctx.workflow_id);

            ctx.sink.emit_text_delta(&node_id, &format!("\n\n*⏳ 正在等待人工确认: **{}**...*\n", title));

            let actions = node_data.get("user_actions").cloned().unwrap_or_else(|| json!([
                { "key": "action_1", "label": "Approve", "enable_feedback": false },
                { "key": "action_2", "label": "Reject", "enable_feedback": true }
            ]));

            // Call langgraph interrupt
            let resume_val = match langgraph::types::interrupt(
                json!({
                    "node_id": node_id,
                    "title": title,
                    "interaction_type": "review",
                    "actions": actions,
                })
            ) {
                Ok(val) => val,
                Err(e) => return Err(RunnableError::Interrupt(e.into())),
            };

            let choice = resume_val.get("choice")
                .or_else(|| resume_val.get("action"))
                .and_then(|v| v.as_str())
                .unwrap_or("action_1")
                .to_string();
            let feedback = resume_val.get("feedback")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let choice_label = actions.as_array()
                .and_then(|arr| arr.iter().find(|act| act.get("key").and_then(|k| k.as_str()) == Some(&choice)))
                .and_then(|act| act.get("label").and_then(|l| l.as_str()))
                .unwrap_or(&choice)
                .to_string();

            if feedback.is_empty() {
                ctx.sink.emit_text_delta(&node_id, &format!("人工确认结果: **{}**", choice_label));
            } else {
                ctx.sink.emit_text_delta(&node_id, &format!("人工确认结果: **{}** — {}", choice_label, feedback));
            }

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "choice": choice,
                "feedback": feedback
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
