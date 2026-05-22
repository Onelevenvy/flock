pub mod bash;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod read;
pub mod tool_search;
pub mod write;


use flock_core::types::tool::{ProviderInfo, I18nString};

/// Provider metadata for all builtin tools.
pub fn provider_info() -> ProviderInfo {
    ProviderInfo {
        provider_id: "builtin".to_string(),
        provider_name: I18nString::new("内置工具", "Built-in Tools"),
        description: I18nString::new(
            "内置控制台工具集，提供文件读写、Shell命令执行、代码搜索等基础开发能力",
            "Built-in terminal toolset providing basic development capabilities such as file read/write, shell command execution, and code search."
        ),
        icon: Some("builtin".to_string()),
        credentials_schema: None,
        test_input: None,
    }
}
