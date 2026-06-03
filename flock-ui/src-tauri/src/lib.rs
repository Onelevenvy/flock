mod ipc;
mod commands;
mod workspace;
mod cron_scheduler;
mod pet;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use commands::assistant::AgentState;
use commands::SharedAgentState;

/// Shared database manager type.
pub type SharedDbManager = Arc<flock_core::db::DbManager>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化共享 Agent 状态
    let agent_state: SharedAgentState = Arc::new(Mutex::new(AgentState::new()));
    let scheduler_agent = agent_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
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
            app.manage(db_arc.clone());

            // 启动后台定时任务调度引擎
            let scheduler_db = db_arc.clone();
            let scheduler_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                cron_scheduler::start(scheduler_db, scheduler_agent, scheduler_app).await;
            });

            // ── Create pet overlay window (transparent, always-on-top, no frame) ──
            pet::setup_pet_overlay(app)?;

            Ok(())
        })
        .manage(agent_state)
        .manage(Arc::new(commands::WorkflowExecutionState::new()))
        .invoke_handler(tauri::generate_handler![
            // Agent 控制
            commands::start_agent,
            commands::stop_agent,
            commands::send_message,
            commands::approve_tool,
            commands::deny_tool,
            commands::resume_tool,
            commands::set_mode,
            commands::set_config,
            commands::ping_agent,
            commands::get_flock_path,
            commands::get_workdir,
            commands::get_active_sandbox_vnc_url,
            commands::destroy_sandbox,
            commands::cleanup_all_sandboxes,
            commands::fetch_vnc_page_content,
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
            commands::save_conversation_messages,
            // 文件
            commands::list_workspace_files,
            commands::read_workspace_file,
            commands::read_workspace_file_as_base64,
            commands::get_workspace_file_absolute_path,
            commands::open_workspace_file_in_system,
            commands::open_external_url,
            commands::create_workspace_file,
            commands::create_workspace_directory,
            commands::upload_workspace_file,
            commands::delete_workspace_file_or_dir,
            commands::download_workspace_file,
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
            commands::upsert_custom_model,
            commands::test_custom_model_connection,
            // 系统配置
            commands::get_app_config,
            commands::set_app_config,
            commands::set_locale,
            commands::test_sandbox_connection,
            commands::create_playwright_snapshot,
            commands::list_daytona_sandboxes,
            commands::delete_daytona_sandbox,
            commands::reuse_sandbox,
            commands::list_daytona_snapshots,
            commands::delete_daytona_snapshot,
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
            // 定时自动 Cron
            commands::list_cron_jobs,
            commands::create_cron_job,
            commands::update_cron_job,
            commands::delete_cron_job,
            commands::set_cron_job_enabled,
            commands::run_cron_job_now,
            // 工作流
            commands::list_workflows,
            commands::get_workflow,
            commands::create_workflow,
            commands::update_workflow,
            commands::publish_workflow,
            commands::list_workflow_versions,
            commands::rollback_workflow_draft,
            commands::switch_workflow_production,
            commands::delete_workflow,
            commands::run_workflow,
            commands::stop_workflow,
            commands::debug_node,
            commands::save_workflow_messages,
            commands::load_workflow_messages,
            pet::sync_pet_state,
            pet::sync_pet_pending_approval,
            pet::sync_pet_minimized,
            pet::pull_pet_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
