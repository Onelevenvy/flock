use tauri::{Manager, Emitter, WebviewWindowBuilder, WebviewUrl};

/// ── 初始化并创建小宠物悬浮窗口 ──
pub fn setup_pet_overlay(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get primary monitor size dynamically to prevent boundary issues
    let (screen_w, screen_h) = if let Ok(Some(monitor)) = app.primary_monitor() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        if scale > 0.0 {
            ((size.width as f64 / scale) as u32, (size.height as f64 / scale) as u32)
        } else {
            (size.width, size.height)
        }
    } else {
        (1920u32, 1080u32)
    };

    // Default size & position: bottom-right corner
    let pet_w = 300u32;
    let pet_h = 320u32;
    let pet_x = (screen_w - pet_w - 6) as i32;
    let pet_y = (screen_h - pet_h - 130) as i32;

    match WebviewWindowBuilder::new(
        app,
        "pet-overlay",
        WebviewUrl::App("index.html?window=pet-overlay".into()),
    )
    .title("XiaoF Pet")
    .inner_size(pet_w as f64, pet_h as f64)
    .position(pet_x as f64, pet_y as f64)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(false)
    .build()
    {
        Ok(pet_win) => {
            log::info!("Pet overlay window created successfully");
            
            // Bind to main window close requested events to shut down overlay window as well
            let main_label = "main";
            if let Some(main_win) = app.get_webview_window(main_label) {
                let pet_handle = pet_win.clone();
                main_win.on_window_event(move |evt| {
                    match evt {
                        tauri::WindowEvent::CloseRequested { .. } => {
                            let _ = pet_handle.close();
                        }
                        _ => {}
                    }
                });
            }
        }
        Err(e) => {
            log::warn!("Could not create pet overlay window: {e}");
        }
    }

    Ok(())
}

#[tauri::command]
pub fn sync_pet_state(state: serde_json::Value, app: tauri::AppHandle) {
    // 1. Global event broadcast (fully accessible by pet-overlay frontend global listen)
    let _ = app.emit("xiaof-state-sync", state.clone());
    
    // 2. Control pet window visibility dynamically
    if let Some(pet_win) = app.get_webview_window("pet-overlay") {
        if let Some(enabled) = state.get("enabled").and_then(|v| v.as_bool()) {
            if enabled {
                let _ = pet_win.show();
            } else {
                let _ = pet_win.hide();
            }
        }
    }
}

#[tauri::command]
pub fn sync_pet_pending_approval(approval: serde_json::Value, app: tauri::AppHandle) {
    let _ = app.emit("xiaof-pending-approval", approval);
}

#[tauri::command]
pub fn sync_pet_minimized(minimized: bool, app: tauri::AppHandle) {
    let _ = app.emit("xiaof-minimized-change", minimized);
}

#[tauri::command]
pub fn pull_pet_state(app: tauri::AppHandle) {
    let _ = app.emit("xiaof-pull-state-request", ());
}
