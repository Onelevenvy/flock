use async_trait::async_trait;
use serde_json::{json, Value};
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{JsonSchema, ToolResult};
use flock_core::types::skill_types::ContextModifier;

pub struct ToolSearchTool;

impl ToolSearchTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(Self)
    }
}

#[async_trait]
impl Tool for ToolSearchTool {
    fn name(&self) -> &str {
        "ToolSearch"
    }

    fn description(&self) -> &str {
        "Search for deferred tools and load their full schema. Use this before calling any deferred tool."
    }

    fn input_schema(&self) -> JsonSchema {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query to match tool names or descriptions"
                }
            },
            "required": ["query"]
        })
    }

    fn is_concurrency_safe(&self, _input: &Value) -> bool {
        true
    }

    async fn execute(&self, input: Value) -> ToolResult {
        let query = input.get("query").and_then(|v| v.as_str()).unwrap_or("");
        if query.is_empty() {
            return ToolResult {
                content: "Error: query is required".to_string(),
                is_error: true,
            };
        }

        let query_lower = query.to_lowercase();
        let tool_defs = crate::get_tool_defs().unwrap_or_default();
        
        let matches: Vec<serde_json::Value> = tool_defs
            .iter()
            .filter(|d| d.deferred)
            .filter(|d| {
                d.name.to_lowercase().contains(&query_lower)
                    || d.description.to_lowercase().contains(&query_lower)
            })
            .map(|d| {
                json!({
                    "name": d.name,
                    "description": d.description,
                    "parameters": d.input_schema
                })
            })
            .collect();

        if matches.is_empty() {
            return ToolResult {
                content: format!("No deferred tools matching \"{}\" found.", query),
                is_error: false,
            };
        }

        ToolResult {
            content: serde_json::to_string_pretty(&matches).unwrap_or_default(),
            is_error: false,
        }
    }

    fn context_modifier_for(&self, input: &Value) -> Option<ContextModifier> {
        let query = input.get("query").and_then(|v| v.as_str()).unwrap_or("");
        if query.is_empty() {
            return None;
        }

        let query_lower = query.to_lowercase();
        let tool_defs = crate::get_tool_defs().unwrap_or_default();
        
        let matches: Vec<String> = tool_defs
            .iter()
            .filter(|d| d.deferred)
            .filter(|d| {
                d.name.to_lowercase().contains(&query_lower)
                    || d.description.to_lowercase().contains(&query_lower)
            })
            .map(|d| d.name.clone())
            .collect();

        if matches.is_empty() {
            return None;
        }

        let mut modifier = ContextModifier::default();
        modifier.promoted_tools = matches;
        Some(modifier)
    }

    fn category(&self) -> ToolCategory {
        ToolCategory::Info
    }
}
