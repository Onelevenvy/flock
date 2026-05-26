pub mod code_execution;
pub mod browser;
pub mod computer_use;
pub mod sandbox_exec;
pub mod request_human_assistance;
pub mod fs_tools;


use flock_core::types::tool::ProviderInfo;

// /// Provider metadata for all builtin tools.
pub fn provider_info() -> ProviderInfo {
    crate::parse_provider_info_from_yaml(
        include_str!("provider.yaml"),
        Some(include_str!("icon.svg")),
    )
}