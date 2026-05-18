mod agent;
mod commands;
mod workspace;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use agent::AgentState;
use commands::SharedAgentState;

/// Shared database manager type.
pub type SharedDbManager = Arc<flock_core::db::DbManager>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化共享 Agent 状态
    let agent_state: SharedAgentState = Arc::new(Mutex::new(AgentState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize the database manager
            let db_manager = tauri::async_runtime::block_on(async {
                let db = flock_core::db::DbManager::init().await
                    .expect("Failed to initialize database");
                // Seed tool providers and tools so they appear in UI before agent starts.
                let tool_set = flock_tools::all_tools();
                let tool_defs = tool_set.registry.to_tool_defs();
                if let Err(e) = db.seed_tool_providers(&tool_set.provider_infos).await {
                    log::error!("Failed to seed tool providers: {}", e);
                }
                if let Err(e) = db.upsert_tools(&tool_defs, &tool_set.provider_infos).await {
                    log::error!("Failed to seed tools: {}", e);
                }
                db
            });

            let db_arc = Arc::new(db_manager) as SharedDbManager;
            // Make DB available to tools for credential resolution.
            flock_tools::init_db_manager(db_arc.clone());
            app.manage(db_arc);
            Ok(())
        })
        .manage(agent_state)
        .invoke_handler(tauri::generate_handler![
            // Agent 控制
            commands::start_agent,
            commands::stop_agent,
            commands::send_message,
            commands::approve_tool,
            commands::deny_tool,
            commands::set_mode,
            commands::set_config,
            commands::ping_agent,
            commands::get_flock_path,
            commands::get_workdir,
            // 工作空间
            commands::get_workspace_root,
            commands::list_workspaces,
            commands::create_workspace,
            commands::delete_workspace,
            // 对话
            commands::list_conversations,
            commands::create_conversation,
            commands::update_conversation_title,
            commands::delete_conversation,
            commands::load_conversation_history,
            // 文件
            commands::list_workspace_files,
            commands::read_workspace_file,
            commands::get_workspace_file_absolute_path,
            commands::open_workspace_file_in_system,
            // 数据库配置
            commands::get_db_path,
            commands::list_providers,
            commands::upsert_provider,
            commands::delete_provider,
            commands::list_models,
            commands::upsert_model,
            commands::delete_model,
            commands::test_provider_connection,
            commands::activate_provider,
            commands::get_active_model,
            commands::set_active_model,
            // 系统配置
            commands::get_app_config,
            commands::set_app_config,
            // 工具提供商
            commands::list_tool_providers,
            commands::list_tools,
            commands::update_tool_provider_credentials,
            commands::test_tool_provider,
            // MCP 服务器
            commands::list_mcp_servers,
            commands::upsert_mcp_server,
            commands::delete_mcp_server,
            commands::set_mcp_server_enabled,
            commands::test_mcp_server,
            // Skills
            commands::list_skills,
            commands::get_extra_skill_dirs,
            commands::add_extra_skill_dir,
            commands::remove_extra_skill_dir,
            // Assistants
            commands::list_assistants,
            commands::create_assistant,
            commands::update_assistant,
            commands::delete_assistant,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
