pub mod bash;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod read;
pub mod tool_search;
pub mod write;
pub mod code_execution;
pub mod browser;

use flock_core::types::tool::ProviderInfo;

/// Provider metadata for all builtin tools.
pub fn provider_info() -> ProviderInfo {
    ProviderInfo {
        provider_id: "builtin".to_string(),
        provider_name: r#"{"zh": "内置工具", "en": "Built-in Tools"}"#.to_string(),
        description: r#"{"zh": "内置控制台工具集，提供文件读写、Shell命令执行、代码搜索等基础开发能力", "en": "Built-in terminal toolset providing basic development capabilities such as file read/write, shell command execution, and code search."}"#.to_string(),
        icon: Some("builtin".to_string()),
        credentials_schema: None,
        test_input: None,
    }
}
