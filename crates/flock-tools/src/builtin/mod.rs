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
    crate::parse_provider_info_from_yaml(
        include_str!("provider.yaml"),
        Some(include_str!("icon.svg")),
    )
}
