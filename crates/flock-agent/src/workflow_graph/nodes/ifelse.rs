use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use langgraph::prelude::RunnableConfig;
use langgraph::runnable::RunnableError;
use super::common::{WorkflowNodeContext, parse_state, interpolate_string};

pub fn make_ifelse_node(
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

            let cases_raw = node_data.get("cases").and_then(|v| v.as_array());
            let mut matched_case_id = "false_else".to_string();

            if let Some(cases) = cases_raw {
                for case in cases {
                    let case_id = case.get("case_id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                    if case_id == "false_else" {
                        continue;
                    }
                    
                    let op = case.get("logical_operator").and_then(|v| v.as_str()).unwrap_or("and");
                    let conditions = case.get("conditions").and_then(|v| v.as_array());

                    let mut case_matched = if op == "and" { true } else { false };

                    if let Some(conds) = conditions {
                        if conds.is_empty() {
                            case_matched = false;
                        } else {
                            for cond in conds {
                                let variable_template = cond.get("variable").and_then(|v| v.as_str()).unwrap_or("");
                                let cmp_op = cond.get("operator").and_then(|v| v.as_str()).unwrap_or("equals");
                                let cmp_val_template = cond.get("value").and_then(|v| v.as_str()).unwrap_or("");

                                let variable = interpolate_string(variable_template, &state);
                                let cmp_val = interpolate_string(cmp_val_template, &state);

                                let cond_result = match cmp_op {
                                    "equals" | "eq" | "==" => variable == cmp_val,
                                    "not_equals" | "neq" | "!=" => variable != cmp_val,
                                    "contains" => variable.contains(&cmp_val),
                                    "not_contains" => !variable.contains(&cmp_val),
                                    "empty" | "is_empty" => variable.trim().is_empty(),
                                    "not_empty" | "is_not_empty" => !variable.trim().is_empty(),
                                    _ => false,
                                };

                                if op == "and" {
                                    case_matched = case_matched && cond_result;
                                } else {
                                    case_matched = case_matched || cond_result;
                                }
                            }
                        }
                    } else {
                        case_matched = false;
                    }

                    if case_matched {
                        matched_case_id = case_id;
                        break;
                    }
                }
            }

            ctx.sink.emit_text_delta(&node_id, &format!("条件分支结果: `{}`", matched_case_id));

            let mut outputs = state.node_outputs.clone();
            if !outputs.is_object() {
                outputs = json!({});
            }
            let node_output = json!({
                "case_id": matched_case_id
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
