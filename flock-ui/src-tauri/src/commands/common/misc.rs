use tauri::State;
use crate::commands::assistant::SharedAgentState;

/// Ping Agent
#[tauri::command]
pub async fn ping_agent(_state: State<'_, SharedAgentState>) -> Result<(), String> {
    Ok(())
}

/// 获取 flock 可执行路径
#[tauri::command]
pub async fn get_flock_path(_state: State<'_, SharedAgentState>) -> Result<String, String> {
    Ok("integrated".to_string())
}
