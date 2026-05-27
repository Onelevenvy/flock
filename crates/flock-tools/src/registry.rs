use flock_core::types::tool::ToolDef;

use crate::Tool;

pub struct ToolRegistry {
    tools: Vec<Box<dyn Tool>>,
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}
impl ToolRegistry {
    pub fn new() -> Self {
        Self { tools: Vec::new() }
    }

    pub fn register(&mut self, tool: Box<dyn Tool>) {
        self.tools.push(tool);
    }

    /// Remove a tool by name
    pub fn remove(&mut self, name: &str) {
        self.tools.retain(|t| t.name() != name);
    }

    /// Find a tool by name
    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools
            .iter()
            .find(|t| t.name() == name)
            .map(|t| t.as_ref())
    }

    /// Get all registered tool names
    pub fn tool_names(&self) -> Vec<String> {
        self.tools.iter().map(|t| t.name().to_string()).collect()
    }

    /// Iterate over all registered tools.
    pub fn tools_iter(&self) -> impl Iterator<Item = &dyn Tool> {
        self.tools.iter().map(|t| t.as_ref())
    }

    /// Generate API tool definitions for all registered tools
    pub fn to_tool_defs(&self) -> Vec<ToolDef> {
        self.tools
            .iter()
            .map(|t| ToolDef {
                name: t.name().to_string(),
                description: t.description().to_string(),
                input_schema: t.input_schema(),
                deferred: t.is_deferred(),
                category: format!("{:?}", t.category()),
                provider_id: t.provider_id().to_string(),
                provider_name: t.provider_name().to_string(),
                needs_auth: t.needs_auth(),
            })
            .collect()
    }

    /// Generate API tool definitions for tools matching a predicate.
    ///
    /// Used by plan mode to restrict the tool set sent to the LLM.
    pub fn to_tool_defs_filtered<F>(&self, filter: F) -> Vec<ToolDef>
    where
        F: Fn(&dyn Tool) -> bool,
    {
        self.tools
            .iter()
            .filter(|t| filter(t.as_ref()))
            .map(|t| ToolDef {
                name: t.name().to_string(),
                description: t.description().to_string(),
                input_schema: t.input_schema(),
                deferred: t.is_deferred(),
                category: format!("{:?}", t.category()),
                provider_id: t.provider_id().to_string(),
                provider_name: t.provider_name().to_string(),
                needs_auth: t.needs_auth(),
            })
            .collect()
    }

    /// Remove all tools whose name is NOT in `allowed`.
    ///
    /// Used by the assistant system to restrict which tools are available.
    pub fn retain_by_providers(&mut self, allowed: &[String]) {
        let allowed_set: std::collections::HashSet<&str> =
            allowed.iter().map(|s| s.as_str()).collect();

        self.tools.retain(|t| {
            let name = t.name();
            allowed_set.contains(name)
        });
    }
}

