use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;

#[tokio::test]
async fn test_diagnose_e2b() {
    let db = DbManager::init().await.expect("Failed to init DB");
    // Get E2B config
    let cfg = flock_tools::sandbox_core::config::get_sandbox_config(&db).await
        .expect("No active sandbox config");

    let api_key = cfg.e2b_api_key.as_ref().expect("E2B API key is missing");
    let base_url = cfg.e2b_api_url.as_deref().unwrap_or("https://api.e2b.app").trim_end_matches('/');

    let client = reqwest::Client::new();
    let url = format!("{}/sandboxes", base_url);
    let resp = client.get(&url)
        .header("X-API-Key", api_key)
        .send()
        .await
        .expect("Failed to get E2B sandboxes");

    let text = resp.text().await.unwrap_or_default();
    println!("Running E2B Sandboxes: {}", text);

    let val: serde_json::Value = serde_json::from_str(&text).expect("Failed to parse JSON");
    if let Some(arr) = val.as_array() {
        for sb in arr {
            if let Some(sandbox_id) = sb.get("sandboxID").or_else(|| sb.get("sandbox_id")).and_then(|v| v.as_str()) {
                println!("Diagnosing E2B Sandbox: {}", sandbox_id);
                let diag_cmd = "echo '--- websockify.log ---'; cat /tmp/websockify.log; echo '--- x11vnc.log ---'; cat /tmp/x11vnc.log";
                if let Ok((stdout, _exit_code)) = flock_tools::sandbox_core::e2b::exec::execute_command(&cfg, sandbox_id, diag_cmd).await {
                    println!("Diagnostics output:\n{}", stdout);
                }
            }
        }
    }
}
