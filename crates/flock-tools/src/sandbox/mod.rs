pub mod code_execution;
pub mod browser;
pub mod computer_use;
pub mod sandbox_exec;


use flock_core::types::tool::ProviderInfo;

// /// Provider metadata for all builtin tools.
pub fn provider_info() -> ProviderInfo {
    ProviderInfo {
        provider_id: "sandbox".to_string(),
        provider_name: r#"{"zh": "Sandbox", "en": "Sandbox"}"#.to_string(),
        description: r#"{"zh": "沙盒环境工具集，提供安全隔离的代码执行、浏览器自动化、计算机操控及沙盒命令执行能力", "en": "Sandboxed toolset providing isolated code execution, browser automation, computer use control, and safe command execution in a secure environment."}"#.to_string(),
        icon: Some("sandbox".to_string()),
        // Special sentinel: tells the DB this provider needs auth (starts unavailable),
        // and tells the UI to redirect to Settings instead of showing an inline cred form.
        credentials_schema: Some(serde_json::json!({ "__type": "sandbox_settings" })),
        test_input: None,
    }
}