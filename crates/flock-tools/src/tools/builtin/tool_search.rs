use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;
use serde_json::json;

/// Search for deferred tools and load their full schema.
/// Use this before calling any deferred tool.
///
/// @param query Search query to match tool names or descriptions
#[tool("ToolSearch")]
pub async fn tool_search(
    query: String
) -> Result<String, String> {
    if query.is_empty() {
        return Err("Error: query is required".to_string());
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
        return Ok(format!("No deferred tools matching \"{}\" found.", query));
    }

    Ok(serde_json::to_string_pretty(&matches).unwrap_or_default())
}

pub struct ToolSearchTool;
impl ToolSearchTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(LangGraphToolAdapter::new(ToolSearch, ToolCategory::Info))
    }
}

