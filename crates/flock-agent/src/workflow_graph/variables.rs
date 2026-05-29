use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use super::state::WorkflowState;

/// Variable types for the typed variable system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VariableType {
    String,
    Number,
    Boolean,
    Object,
    Array,
}

impl VariableType {
    pub fn from_json_value(val: &JsonValue) -> Self {
        match val {
            JsonValue::String(_) => VariableType::String,
            JsonValue::Number(_) => VariableType::Number,
            JsonValue::Bool(_) => VariableType::Boolean,
            JsonValue::Array(_) => VariableType::Array,
            JsonValue::Object(_) => VariableType::Object,
            JsonValue::Null => VariableType::String,
        }
    }
}

/// A typed variable with metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypedVariable {
    pub name: String,
    pub var_type: VariableType,
    pub value: JsonValue,
}

/// Variable scope that resolves variable references from multiple sources.
/// Supports:
/// - `${node_id.field}` — references from node_outputs
/// - `${start.query}` — special alias for input_msg
/// - `sys.*` — system variables (query, workflow_id, timestamp, current_node_id)
/// - `env.*` — user-defined environment variables
pub struct VariableScope<'a> {
    pub state: &'a WorkflowState,
    pub system_vars: &'a HashMap<String, JsonValue>,
    pub env_vars: &'a HashMap<String, JsonValue>,
}

impl<'a> VariableScope<'a> {
    pub fn new(
        state: &'a WorkflowState,
        system_vars: &'a HashMap<String, JsonValue>,
        env_vars: &'a HashMap<String, JsonValue>,
    ) -> Self {
        Self { state, system_vars, env_vars }
    }

    /// Resolve a variable path to a typed variable.
    /// Paths: "start.query", "sys.query", "env.API_KEY", "node_id.field"
    pub fn resolve(&self, path: &str) -> Option<TypedVariable> {
        // System variables: sys.*
        if let Some(var_name) = path.strip_prefix("sys.") {
            return self.system_vars.get(var_name).map(|v| TypedVariable {
                name: var_name.to_string(),
                var_type: VariableType::from_json_value(v),
                value: v.clone(),
            });
        }

        // Environment variables: env.*
        if let Some(var_name) = path.strip_prefix("env.") {
            return self.env_vars.get(var_name).map(|v| TypedVariable {
                name: var_name.to_string(),
                var_type: VariableType::from_json_value(v),
                value: v.clone(),
            });
        }

        // Special alias: start.query -> input_msg
        if path == "start.query" {
            return Some(TypedVariable {
                name: "query".to_string(),
                var_type: VariableType::String,
                value: JsonValue::String(self.state.input_msg.clone()),
            });
        }

        // Node output references: node_id.field
        let parts: Vec<&str> = path.split('.').collect();
        if parts.len() < 2 {
            return None;
        }
        let node_id = parts[0];
        let field = parts[1];

        self.state.node_outputs.get(node_id).and_then(|node_out| {
            node_out.get(field).map(|val| TypedVariable {
                name: format!("{}.{}", node_id, field),
                var_type: VariableType::from_json_value(val),
                value: val.clone(),
            })
        })
    }

    /// Resolve a variable and return its string representation.
    pub fn resolve_string(&self, path: &str) -> Option<String> {
        self.resolve(path).map(|tv| match &tv.value {
            JsonValue::String(s) => s.clone(),
            other => other.to_string(),
        })
    }
}

/// Interpolate a template string with variable references.
/// Replaces `${...}` placeholders with resolved values from the scope.
pub fn resolve_and_interpolate(template: &str, scope: &VariableScope) -> String {
    let re = regex::Regex::new(r"\$\{([^}]+)\}").unwrap();
    re.replace_all(template, |caps: &regex::Captures| {
        let path = &caps[1];
        scope.resolve_string(path).unwrap_or_else(|| caps[0].to_string())
    }).into_owned()
}

/// Interpolate all string values in a JSON tree.
pub fn resolve_and_interpolate_json(val: &JsonValue, scope: &VariableScope) -> JsonValue {
    match val {
        JsonValue::String(s) => JsonValue::String(resolve_and_interpolate(s, scope)),
        JsonValue::Array(arr) => JsonValue::Array(
            arr.iter().map(|item| resolve_and_interpolate_json(item, scope)).collect()
        ),
        JsonValue::Object(obj) => {
            let mut new_obj = serde_json::Map::new();
            for (k, v) in obj.iter() {
                new_obj.insert(k.clone(), resolve_and_interpolate_json(v, scope));
            }
            JsonValue::Object(new_obj)
        }
        _ => val.clone(),
    }
}

/// Build system variables from state and context.
pub fn build_system_vars(
    state: &WorkflowState,
    workflow_id: &str,
) -> HashMap<String, JsonValue> {
    let mut vars = HashMap::new();
    vars.insert("query".to_string(), JsonValue::String(state.input_msg.clone()));
    vars.insert("workflow_id".to_string(), JsonValue::String(workflow_id.to_string()));
    vars.insert("current_node".to_string(), JsonValue::String(state.current_node.clone()));
    vars.insert("timestamp".to_string(), JsonValue::Number(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            .into()
    ));
    vars
}
