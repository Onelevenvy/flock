pub mod code_execution;
pub mod browser;
pub mod computer_use;
pub mod sandbox_exec;
pub mod request_human_assistance;
pub mod fs_tools;


use flock_core::types::tool::{ProviderInfo, I18nString};

// /// Provider metadata for all builtin tools.
pub fn provider_info() -> ProviderInfo {
    ProviderInfo {
        provider_id: "sandbox".to_string(),
        provider_name: I18nString::new("Sandbox", "Sandbox"),
        description: I18nString::new(
            "沙盒环境工具集，提供安全隔离的代码执行、浏览器自动化、计算机操控及沙盒命令执行能力",
            "Sandboxed toolset providing isolated code execution, browser automation, computer use control, and safe command execution in a secure environment."
        ),
        icon: Some("sandbox".to_string()),
        // Special sentinel: tells the DB this provider needs auth (starts unavailable),
        // and tells the UI to redirect to Settings instead of showing an inline cred form.
        credentials_schema: Some(serde_json::json!({ "__type": "sandbox_settings" })),
        test_input: None,
    }
}