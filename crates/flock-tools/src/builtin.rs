pub mod bash;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod read;
pub mod tool_search;
pub mod write;

use flock_core::types::tool::ProviderInfo;

/// Provider metadata for all builtin tools.
pub fn provider_info() -> ProviderInfo {
    ProviderInfo {
        provider_id: "builtin".to_string(),
        provider_name: "Built-in Tools".to_string(),
        description: "内置工具集，提供文件读写、Shell命令执行、代码搜索等基础开发能力".to_string(),
        icon: None,
        credentials_schema: None,
        test_input: None,
    }
}