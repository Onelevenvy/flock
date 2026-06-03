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
        let path = path.trim();
        // System variables: sys.*
        if let Some(var_name) = path.strip_prefix("sys.") {
            let var_name = var_name.trim();
            return self.system_vars.get(var_name).map(|v| TypedVariable {
                name: var_name.to_string(),
                var_type: VariableType::from_json_value(v),
                value: v.clone(),
            });
        }

        // Environment variables: env.*
        if let Some(var_name) = path.strip_prefix("env.") {
            let var_name = var_name.trim();
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

        // Node output references: node_id.field1.field2...
        let parts: Vec<&str> = path.split('.').map(|s| s.trim()).collect();
        if parts.len() < 2 {
            return None;
        }
        let node_id = parts[0];

        self.state.node_outputs.get(node_id).and_then(|node_out| {
            // 1. Try to traverse path sequentially: parts[1], parts[2], ...
            let mut current_val = node_out;
            let mut resolved = true;
            for &field in &parts[1..] {
                if let Some(next_val) = current_val.get(field) {
                    current_val = next_val;
                } else {
                    resolved = false;
                    break;
                }
            }

            if resolved {
                return Some(TypedVariable {
                    name: path.to_string(),
                    var_type: VariableType::from_json_value(current_val),
                    value: current_val.clone(),
                });
            }

            // 2. Fallback: If not fully resolved, check if it's a parameter_extractor style node,
            // where the actual variables are nested inside "parameters" field.
            // For example: ${parameterExtractor.expression} instead of ${parameterExtractor.parameters.expression}
            if parts.len() == 2 {
                let field = parts[1];
                if let Some(params_obj) = node_out.get("parameters") {
                    if let Some(val) = params_obj.get(field) {
                        return Some(TypedVariable {
                            name: path.to_string(),
                            var_type: VariableType::from_json_value(val),
                            value: val.clone(),
                        });
                    }
                }
            }

            None
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

/// Interpolate all string values in a JSON tree, preserving raw variable types for single variable placeholders.
pub fn resolve_and_interpolate_json(val: &JsonValue, scope: &VariableScope) -> JsonValue {
    match val {
        JsonValue::String(s) => {
            let trimmed = s.trim();
            if trimmed.starts_with("${") && trimmed.ends_with('}') {
                let inner = &trimmed[2..trimmed.len() - 1];
                if !inner.contains("${") && !inner.contains('}') {
                    if let Some(tv) = scope.resolve(inner) {
                        return tv.value;
                    }
                }
            }
            JsonValue::String(resolve_and_interpolate(s, scope))
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_variable_resolve() {
        let state = WorkflowState {
            input_msg: "hello".to_string(),
            messages: vec![],
            node_outputs: json!({
                "parameterExtractor": {
                    "parameters": {
                        "expression": "1 + 1"
                    }
                },
                "otherNode": {
                    "result": "success"
                }
            }),
            current_node: "".to_string(),
            quit_requested: false,
            env_vars: json!({}),
        };

        let system_vars = HashMap::new();
        let env_vars = HashMap::new();
        let scope = VariableScope::new(&state, &system_vars, &env_vars);

        // Test normal resolve
        let v1 = scope.resolve("otherNode.result").unwrap();
        assert_eq!(v1.value, json!("success"));

        // Test multi-level resolve
        let v2 = scope.resolve("parameterExtractor.parameters.expression").unwrap();
        assert_eq!(v2.value, json!("1 + 1"));

        // Test fallback resolve
        let v3 = scope.resolve("parameterExtractor.expression").unwrap();
        assert_eq!(v3.value, json!("1 + 1"));

        // Test trim resolve
        let v4 = scope.resolve("  parameterExtractor.expression  ").unwrap();
        assert_eq!(v4.value, json!("1 + 1"));

        // Test trim with dots
        let v5 = scope.resolve("parameterExtractor . expression").unwrap();
        assert_eq!(v5.value, json!("1 + 1"));
    }
}
