use async_trait::async_trait;
use serde_json::Value;

use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{JsonSchema, ToolResult};
use langgraph_prebuilt::BaseTool;

use crate::Tool;

pub struct LangGraphToolAdapter {
    inner: Box<dyn BaseTool>,
    name: String,
    description: String,
    schema: JsonSchema,
    category: ToolCategory,
    provider_id: Option<String>,
    provider_name: Option<String>,
}

impl LangGraphToolAdapter {
    pub fn new(tool: impl BaseTool + 'static, category: ToolCategory) -> Self {
        let name = tool.name().to_string();
        let description = tool.description().to_string();
        let schema = tool.parameters().cloned().unwrap_or_else(|| serde_json::json!({}));
        Self {
            inner: Box::new(tool),
            name,
            description,
            schema,
            category,
            provider_id: None,
            provider_name: None,
        }
    }

    pub fn with_provider_id(mut self, id: impl Into<String>) -> Self {
        self.provider_id = Some(id.into());
        self
    }

    pub fn with_provider_name(mut self, name: impl Into<String>) -> Self {
        self.provider_name = Some(name.into());
        self
    }
}

#[async_trait]
impl Tool for LangGraphToolAdapter {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn input_schema(&self) -> JsonSchema {
        self.schema.clone()
    }

    fn is_concurrency_safe(&self, _input: &Value) -> bool {
        // langgraph tools are generally stateless or self-contained
        true
    }

    async fn execute(&self, input: Value) -> ToolResult {
        let config = langgraph_checkpoint::config::RunnableConfig::new();
        match self.inner.ainvoke(&input, &config).await {
            Ok(content) => ToolResult {
                content: match content {
                    Value::String(s) => s,
                    _ => serde_json::to_string(&content).unwrap_or_default(),
                },
                is_error: false,
            },
            Err(e) => ToolResult {
                content: e.to_string(),
                is_error: true,
            },
        }
    }

    fn category(&self) -> ToolCategory {
        self.category.clone()
    }

    fn describe(&self, input: &Value) -> String {
        format!("{}: {}", self.name, serde_json::to_string(input).unwrap_or_default())
    }

    fn provider_id(&self) -> &str {
        self.provider_id.as_deref().unwrap_or("builtin")
    }

    fn provider_name(&self) -> &str {
        self.provider_name.as_deref().unwrap_or("Built-in Tools")
    }
}
