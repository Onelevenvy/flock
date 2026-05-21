use std::path::PathBuf;
use flock_core::db::DbManager;
use flock_tools::daytona::{get_sandbox_config, get_api_base, execute_command_in_sandbox};

#[tokio::test]
async fn test_diagnose_sandbox() {
    let db_path = flock_core::config::db_path::resolve_db_path();
    println!("Database path resolved to: {:?}", db_path);
    
    let db = match DbManager::init().await {
        Ok(d) => d,
        Err(e) => {
            println!("Failed to open DB: {}", e);
            return;
        }
    };

    let cfg = match get_sandbox_config(&db).await {
        Some(c) => c,
        None => {
            println!("No active sandbox config found or sandbox is disabled.");
            return;
        }
    };

    let api_url = cfg.api_url.as_ref().unwrap();
    let api_key = cfg.api_key.as_ref().unwrap();
    let base = get_api_base(api_url);
    println!("Daytona API URL: {}", base);

    let client = reqwest::Client::new();
    let list_url = format!("{}/api/sandbox", base);
    let resp = match client.get(&list_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await 
    {
        Ok(r) => r,
        Err(e) => {
            println!("Failed to contact Daytona API: {}", e);
            return;
        }
    };

    let text = resp.text().await.unwrap_or_default();
    let val: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            println!("Failed to parse response: {}. Body: {}", e, text);
            return;
        }
    };

    let sandboxes = val.as_array()
        .cloned()
        .unwrap_or_else(|| {
            val.get("items").or_else(|| val.get("data"))
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default()
        });

    if sandboxes.is_empty() {
        println!("No sandboxes are currently active in the cloud.");
        return;
    }

    for sb in &sandboxes {
        let id = sb.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        if id.is_empty() { continue; }

        let state = sb.get("state").or_else(|| sb.get("status"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        println!("\n=============================================");
        println!("Diagnosing Sandbox ID: {} (State: {})", id, state);
        println!("=============================================");

        // 1. which commands
        println!("\n--- [1] Executables Check (which) ---");
        let (out, code) = execute_command_in_sandbox(&db, id, "which Xvfb fluxbox x11vnc websockify python3 chromium").await
            .unwrap_or(("Failed to run which".to_string(), -1));
        println!("Exit Code: {}\nOutput:\n{}", code, out.trim());

        // 2. test running Xvfb version
        println!("\n--- [2] Xvfb version check ---");
        let (out, code) = execute_command_in_sandbox(&db, id, "Xvfb -version").await
            .unwrap_or(("Failed to run Xvfb -version".to_string(), -1));
        println!("Exit Code: {}\nOutput:\n{}", code, out.trim());

        // 3. test running fluxbox version
        println!("\n--- [3] Fluxbox version check ---");
        let (out, code) = execute_command_in_sandbox(&db, id, "fluxbox -version").await
            .unwrap_or(("Failed to run fluxbox -version".to_string(), -1));
        println!("Exit Code: {}\nOutput:\n{}", code, out.trim());

        // 4. try starting Xvfb on display :0 manually and check error
        println!("\n--- [4] Run Xvfb manually in foreground briefly ---");
        let (out, code) = execute_command_in_sandbox(&db, id, "timeout 3 Xvfb :99 -screen 0 1280x1024x24").await
            .unwrap_or(("Failed to run Xvfb manually".to_string(), -1));
        println!("Exit Code: {}\nOutput:\n{}", code, out.trim());

        // 5. ss -tuln
        println!("\n--- [5] Port listening status (ss -tuln) ---");
        let (out, _) = execute_command_in_sandbox(&db, id, "ss -tuln || netstat -tuln").await
            .unwrap_or(("Failed to execute ss -tuln".to_string(), -1));
        println!("{}", out.trim());
    }
}
