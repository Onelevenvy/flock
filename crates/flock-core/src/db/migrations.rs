// Migration SQL statements, applied in order by version number.
// Each entry is (version, name, sql).

pub const MIGRATIONS: &[(i64, &str, &str)] = &[
    (
        1,
        "init_schema",
        "CREATE TABLE IF NOT EXISTS app_config (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS model_provider (
            id                TEXT PRIMARY KEY,
            provider_name     TEXT NOT NULL UNIQUE,
            provider_type     TEXT NOT NULL DEFAULT 'openai',
            base_url          TEXT,
            api_key_encrypted TEXT,
            api_key_nonce     TEXT,
            icon              TEXT,
            description       TEXT,
            test_model        TEXT,
            is_available      INTEGER NOT NULL DEFAULT 0,
            created_at        TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS model (
            id          TEXT PRIMARY KEY,
            provider_id TEXT NOT NULL,
            model_name  TEXT NOT NULL,
            categories  TEXT,
            capabilities TEXT,
            is_online   INTEGER NOT NULL DEFAULT 0,
            meta        TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES model_provider(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_model_provider_id ON model(provider_id);

        CREATE TABLE IF NOT EXISTS encryption_meta (
            id           INTEGER PRIMARY KEY CHECK (id = 1),
            key_salt     TEXT NOT NULL,
            key_version  INTEGER NOT NULL DEFAULT 1,
            created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS session_metadata (
            thread_id    TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL DEFAULT '',
            provider     TEXT NOT NULL DEFAULT '',
            cwd          TEXT NOT NULL DEFAULT '',
            model        TEXT NOT NULL DEFAULT '',
            summary      TEXT NOT NULL DEFAULT '',
            messages     TEXT NOT NULL DEFAULT '[]',
            msg_count    INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT NOT NULL,
            updated_at   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tool_provider (
            id                    TEXT PRIMARY KEY,
            provider_name         TEXT NOT NULL,
            description           TEXT,
            icon                  TEXT,
            is_available          INTEGER NOT NULL DEFAULT 1,
            credentials_encrypted TEXT,
            credentials_nonce     TEXT,
            credentials_schema    TEXT,
            created_at            TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tool (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL UNIQUE,
            description  TEXT NOT NULL,
            category     TEXT NOT NULL,
            input_schema TEXT NOT NULL,
            provider_id  TEXT NOT NULL DEFAULT 'builtin',
            is_deferred  INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES tool_provider(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_tool_provider_id ON tool(provider_id);

        CREATE TABLE IF NOT EXISTS mcp_server (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL UNIQUE,
            transport       TEXT NOT NULL DEFAULT 'stdio',
            command         TEXT,
            args            TEXT,
            env             TEXT,
            url             TEXT,
            headers         TEXT,
            deferred        INTEGER NOT NULL DEFAULT 1,
            is_connected    INTEGER NOT NULL DEFAULT 0,
            last_error      TEXT,
            tool_count      INTEGER NOT NULL DEFAULT 0,
            enabled         INTEGER NOT NULL DEFAULT 1,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_mcp_server_name ON mcp_server(name);

        CREATE TABLE IF NOT EXISTS assistant (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            icon            TEXT NOT NULL DEFAULT '🤖',
            description     TEXT NOT NULL DEFAULT '',
            model           TEXT NOT NULL DEFAULT '',
            system_prompt   TEXT NOT NULL DEFAULT '',
            tools           TEXT NOT NULL DEFAULT '[]',
            skills          TEXT NOT NULL DEFAULT '[]',
            is_builtin      INTEGER NOT NULL DEFAULT 0,
            sort_order      INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_assistant_builtin ON assistant(is_builtin);

        CREATE TABLE IF NOT EXISTS cron_job (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            description         TEXT NOT NULL DEFAULT '',
            enabled             INTEGER NOT NULL DEFAULT 1,
            schedule_kind       TEXT NOT NULL,
            schedule_value      TEXT NOT NULL,
            schedule_desc       TEXT NOT NULL DEFAULT '',
            execution_mode      TEXT NOT NULL DEFAULT 'new_conversation',
            prompt              TEXT NOT NULL,
            workspace_id        TEXT NOT NULL,
            assistant_id        TEXT NOT NULL,
            next_run_at         INTEGER,
            last_run_at         INTEGER,
            last_status         TEXT NOT NULL DEFAULT 'ok',
            last_error          TEXT,
            run_count           INTEGER NOT NULL DEFAULT 0,
            last_conversation_id TEXT,
            created_at          TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_cron_job_workspace ON cron_job(workspace_id);",
    ),
];
