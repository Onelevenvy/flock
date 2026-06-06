use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{ProviderInfo, I18nString};
use langgraph::tool;

/// Evaluates a math expression locally using meval.
///
/// @param expression The math expression to evaluate, e.g. "2 + 3 * sqrt(16)"
#[tool("Math Calculator")]
pub async fn math_calculator(expression: String) -> Result<String, String> {
    let expr = expression.trim().replace("\\*", "*");
    match meval::eval_str(&expr) {
        Ok(result) => Ok(format!("{}", result)),
        Err(e) => Err(format!(
            "Error evaluating expression '{}': {}",
            expression, e
        )),
    }
}

pub struct MathTool;
impl MathTool {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(MathCalculator, ToolCategory::Exec)
                .with_provider_id("math")
                .with_provider_name("Math Calculator"),
        )
    }
}

pub fn provider_info() -> ProviderInfo {
    crate::parse_provider_info_from_yaml(
        include_str!("provider.yaml"),
        Some(include_str!("icon.svg")),
    )
}
