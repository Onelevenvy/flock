use std::path::PathBuf;
use flock_core::db::DbManager;
use flock_tools::sandbox_core::daytona::{get_sandbox_config, get_api_base, execute_command_in_sandbox};

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

        // 6. test signed-preview-url endpoint
        println!("\n--- [6] Signed Preview URL Check ---");
        let test_url = format!("{}/api/sandbox/{}/ports/6080/signed-preview-url", base, id);
        let test_resp = client.get(&test_url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await;
        match test_resp {
            Ok(r) => {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                println!("Port 6080 Signed Preview API Response Status: {}", status);
                println!("Response Body: {}", body);
            }
            Err(e) => {
                println!("Request to Signed Preview API failed: {}", e);
            }
        }
    }
}

#[tokio::test]
async fn test_diagnose_e2b_templates() {
    let db = match DbManager::init().await {
        Ok(d) => d,
        Err(e) => {
            println!("Failed to open DB: {}", e);
            return;
        }
    };

    // Load sandbox config (enabled or not)
    let mut cfg: flock_core::config::settings::SandboxConfig = db.get_config("sandbox").await.unwrap();
    if let (Some(ct), Some(n)) = (&cfg.e2b_api_key_encrypted, &cfg.e2b_api_key_nonce) {
        if let Ok(salt) = db.get_or_create_salt().await {
            if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                cfg.e2b_api_key = Some(decrypted);
            }
        }
    }

    let key = cfg.e2b_api_key.unwrap_or_default();
    println!("Retrieved E2B Key length: {}", key.len());
    if key.is_empty() {
        println!("E2B API Key is empty in database!");
        return;
    }

    println!("E2B Key starts with: {}", &key[..std::cmp::min(10, key.len())]);

    let client = reqwest::Client::new();
    let url = "https://api.e2b.app/templates";
    let resp = match client.get(url)
        .header("X-API-Key", &key)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            println!("HTTP Request failed: {}", e);
            return;
        }
    };

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    println!("HTTP Response Status: {}", status);
    println!("HTTP Response Body: {}", text);
}

#[tokio::test]
async fn test_diagnose_e2b_sandbox() {
    let db = match DbManager::init().await {
        Ok(d) => d,
        Err(e) => {
            println!("Failed to open DB: {}", e);
            return;
        }
    };

    let mut cfg: flock_core::config::settings::SandboxConfig = db.get_config("sandbox").await.unwrap();
    if let (Some(ct), Some(n)) = (&cfg.e2b_api_key_encrypted, &cfg.e2b_api_key_nonce) {
        if let Ok(salt) = db.get_or_create_salt().await {
            if let Ok(decrypted) = flock_core::crypto::decrypt_value(ct, n, &salt) {
                cfg.e2b_api_key = Some(decrypted);
            }
        }
    }

    // Set template to the desktop template ID
    cfg.snapshot = Some("k0wmnzir0zuzye6dndlw".to_string());

    use flock_tools::sandbox_core::provider::SandboxProvider;
    let prov = flock_tools::sandbox_core::e2b_provider::E2BSandboxProvider;
    
    println!("Starting E2B sandbox with template k0wmnzir0zuzye6dndlw...");
    let sandbox_id = match prov.get_or_create_sandbox(&cfg).await {
        Ok(id) => id,
        Err(e) => {
            println!("Failed to create sandbox: {}", e);
            return;
        }
    };
    println!("Sandbox started successfully: {}", sandbox_id);

    // Ensure VNC running
    println!("Ensuring VNC is running...");
    if let Err(e) = flock_tools::sandbox_core::daytona::ensure_vnc_running_in_sandbox(&db, &sandbox_id).await {
        println!("ensure_vnc_running_in_sandbox error: {}", e);
    }

    // 1. Check listening ports and env
    println!("\n--- Env and Path ---");
    let env_out = match prov.execute_command(&cfg, &sandbox_id, "env && echo 'PATH IS:' && echo $PATH").await {
        Ok((out, _)) => out,
        Err(e) => format!("Error executing env command: {}", e),
    };
    println!("{}", env_out);

    // 2. Check installed debian packages
    println!("\n--- Debian Packages Check ---");
    let dpkg_out = match prov.execute_command(&cfg, &sandbox_id, "dpkg -l | grep -iE 'vnc|xvfb|fluxbox|websockify|novnc'").await {
        Ok((out, _)) => out,
        Err(e) => format!("Error executing dpkg command: {}", e),
    };
    println!("{}", dpkg_out);

    // 3. Check logs of vnc
    println!("\n--- VNC logs ---");
    let log_out = match prov.execute_command(&cfg, &sandbox_id, "cat /tmp/vnc_start.log /tmp/websockify.log /tmp/x11vnc.log 2>/dev/null").await {
        Ok((out, _)) => out,
        Err(e) => format!("Error executing cat command: {}", e),
    };
    println!("{}", log_out);

    // Cleanup
    println!("\nDestroying sandbox...");
    let _ = prov.destroy_sandbox(&cfg, &sandbox_id).await;
    println!("Sandbox destroyed.");
}
