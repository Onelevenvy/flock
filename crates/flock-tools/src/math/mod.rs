use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{ProviderInfo, I18nString};
use langgraph_derive::tool;

/// Evaluates a math expression locally using meval.
///
/// @param expression The math expression to evaluate, e.g. "2 + 3 * sqrt(16)"
#[tool("Math Calculator")]
pub async fn math_calculator(expression: String) -> Result<String, String> {
    match meval::eval_str(&expression) {
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
    ProviderInfo {
        provider_id: "math".to_string(),
        provider_name: I18nString::new("数学计算器", "Math Calculator"),
        description: I18nString::new(
            "数学表达式计算工具，支持基本运算、函数和常量",
            "Mathematical expression calculator tool supporting basic operations, functions, and constants."
        ),
        icon: None,
        credentials_schema: None,
        test_input: None,
    }
}

