use flock_core::db::DbManager;
use flock_core::config::settings::SandboxConfig;

#[tokio::test]
async fn test_diagnose_e2b() {
    let db = DbManager::init().await.expect("Failed to init DB");
    // Get E2B config
    let cfg = flock_tools::sandbox_core::config::get_sandbox_config(&db).await
        .expect("No active sandbox config");

    let api_key = cfg.e2b_api_key.as_ref().expect("E2B API key is missing");
    println!("API Key found: {}", api_key);

    // Create a new sandbox for testing
    println!("Creating a new E2B sandbox...");
    let sandbox_id = match flock_tools::sandbox_core::e2b::lifecycle::create_sandbox(&cfg).await {
        Ok(id) => id,
        Err(e) => {
            println!("Failed to create sandbox: {:?}", e);
            return;
        }
    };
    println!("Created sandbox ID: {}", sandbox_id);

    // Wait a few seconds for VNC processes to fully initialize
    println!("Waiting for processes to initialize...");
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

    // Check logs and processes using execute_command helper
    println!("--- Process status ---");
    let check_ps = "ps aux | grep -E 'Xvfb|fluxbox|x11vnc|websockify'";
    match flock_tools::sandbox_core::e2b::exec::execute_command(&cfg, &sandbox_id, check_ps).await {
        Ok((stdout, code)) => println!("Exit code: {}\nStdout:\n{}", code, stdout),
        Err(e) => println!("Error running ps check: {:?}", e),
    }

    // Check logs
    let diag_cmd = "echo '=== xvfb.log ==='; cat /tmp/xvfb.log; echo '=== fluxbox.log ==='; cat /tmp/x11vnc.log; echo '=== websockify.log ==='; cat /tmp/websockify.log";
    println!("--- Logs ---");
    match flock_tools::sandbox_core::e2b::exec::execute_command(&cfg, &sandbox_id, diag_cmd).await {
        Ok((stdout, code)) => println!("Exit code: {}\nStdout:\n{}", code, stdout),
        Err(e) => println!("Error running logs check: {:?}", e),
    }

    // Destroy the sandbox
    println!("Destroying sandbox {}...", sandbox_id);
    let _ = flock_tools::sandbox_core::e2b::lifecycle::destroy_sandbox(&cfg, &sandbox_id).await;
    println!("Done.");
}
