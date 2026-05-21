use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use regex::Regex;
use langgraph_prebuilt::BaseChatModel;
use flock_core::db::DbManager;
use flock_tools::registry::ToolRegistry;
use super::super::state::WorkflowState;

/// Output sink for workflow execution
pub trait WorkflowSink: Send + Sync {
    fn emit_node_start(&self, node_id: &str);
    fn emit_node_done(&self, node_id: &str, output: &JsonValue);
    fn emit_text_delta(&self, node_id: &str, text: &str);
    fn emit_thinking(&self, node_id: &str, text: &str);
    fn emit_error(&self, msg: &str);
}

/// Node execution context
pub struct WorkflowNodeContext {
    pub provider: Arc<dyn BaseChatModel>,
    pub tools: Arc<ToolRegistry>,
    pub db: Arc<DbManager>,
    pub sink: Arc<dyn WorkflowSink>,
    pub debug_mode: bool,
}

pub fn interpolate_string(template: &str, state: &WorkflowState) -> String {
    // Matches ${some_node_id.some_field} or ${start.query}
    let re = Regex::new(r"\$\{([^}]+)\}").unwrap();
    re.replace_all(template, |caps: &regex::Captures| {
        let path = &caps[1];
        if path == "start.query" {
            return state.input_msg.clone();
        }
        
        let parts: Vec<&str> = path.split('.').collect();
        if parts.len() < 2 {
            return caps[0].to_string();
        }
        
        let node_id = parts[0];
        let field = parts[1];
        
        if let Some(node_out) = state.node_outputs.get(node_id) {
            if let Some(val) = node_out.get(field) {
                if let Some(s) = val.as_str() {
                    return s.to_string();
                } else {
                    return val.to_string();
                }
            }
        }
        caps[0].to_string()
    }).into_owned()
}

pub fn interpolate_json(val: &JsonValue, state: &WorkflowState) -> JsonValue {
    match val {
        JsonValue::String(s) => JsonValue::String(interpolate_string(s, state)),
        JsonValue::Array(arr) => JsonValue::Array(arr.iter().map(|item| interpolate_json(item, state)).collect()),
        JsonValue::Object(obj) => {
            let mut new_obj = serde_json::Map::new();
            for (k, v) in obj.iter() {
                new_obj.insert(k.clone(), interpolate_json(v, state));
            }
            JsonValue::Object(new_obj)
        }
        _ => val.clone(),
    }
}

pub fn parse_state(input: &JsonValue) -> WorkflowState {
    serde_json::from_value(input.clone()).unwrap_or_else(|_| {
        WorkflowState {
            input_msg: String::new(),
            messages: vec![],
            node_outputs: json!({}),
            current_node: String::new(),
            quit_requested: false,
        }
    })
}
