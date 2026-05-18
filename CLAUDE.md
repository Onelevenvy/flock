# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flock is a multi-provider AI agent CLI with tool orchestration support. It's a Rust workspace with a Tauri-based desktop UI (React + TypeScript + Mantine).

## Build & Development Commands

### Rust Backend
```bash
# Build the CLI
cargo build --release

# Run in single-shot mode
cargo run -- "your question"

# Run interactive REPL
cargo run

# Run with specific provider/profile
cargo run -- --profile deepseek "your question"

# Run tests (workspace-wide)
cargo test

# Run a single crate's tests
cargo test -p flock-core
cargo test -p flock-agent
cargo test -p flock-tools
cargo test -p flock-skills

# Run a specific test
cargo test -p flock-core test_name

# Lint
cargo clippy --workspace
```

### Tauri Desktop UI
```bash
cd flock-ui

# Install dependencies
npm install

# Development server
npm run dev
# or
npm run tauri dev

# Build for production
npm run build
# or
npm run tauri build

# Lint frontend
npm run lint
```

## Architecture

### Workspace Crates

| Crate | Purpose |
|-------|---------|
| `flock-core` | Core types, config, database, IPC interface, crypto, model factory |
| `flock-agent` | Agent engine, session management, tool execution, memory, graph orchestration |
| `flock-tools` | Tool registry, built-in tools (Read/Write/Edit/Bash/Grep/Glob), MCP integration, math/weather tools |
| `flock-skills` | Skill discovery, loading, frontmatter parsing, hooks, permissions, bundled skills |
| `flock-ui/src-tauri` | Tauri desktop app backend (commands, agent state, workspace management) |
| `workspace-hack` | cargo-hakari build optimization |

### Key Dependencies

- **LangGraph**: Local Rust reimplementation (`../langgraph-rust/`) for agent graph orchestration
- **LLM Providers**: OpenAI-compatible (default), Anthropic, AWS Bedrock, Google Vertex
- **Database**: SQLite via sqlx for sessions, conversations, providers, tools, MCP servers
- **Async Runtime**: Tokio

### Core Architecture Patterns

**Agent Engine** (`flock-agent/src/engine.rs`):
- `AgentEngine` orchestrates the LLM interaction loop
- Uses LangGraph `CompiledStateGraph` for execution flow
- Manages conversation history via SQLite checkpointer
- Handles tool approval, context compression, plan mode

**Tool System** (`flock-tools/src/lib.rs`):
- `Tool` trait defines the interface: `name()`, `description()`, `input_schema()`, `execute()`
- `ToolRegistry` manages all registered tools
- Built-in tools: Read, Write, Edit, Bash, Grep, Glob
- Extensible via MCP servers and custom tool providers

**Skills System** (`flock-skills/`):
- Markdown files with YAML frontmatter in `.flock/skills/`
- Supports `$ARGUMENTS` substitution, shell execution, conditional activation
- Two execution contexts: `inline` (same agent) and `fork` (sub-agent)
- Hot-reload via file watcher

**Memory System** (`flock-agent/src/memory/`):
- Four types: `user`, `feedback`, `project`, `reference`
- Stored as Markdown files with frontmatter in `<config>/flock/projects/<project>/memory/`
- `MEMORY.md` index file auto-loaded into system prompt

**IPC Interface** (`flock-core/src/ipc_interface/`):
- JSON-based protocol for host ↔ agent communication
- Events (Agent → Host): `ready`, `stream_start`, `text_delta`, `tool_request`, `tool_result`, etc.
- Commands (Host → Agent): `message`, `stop`, `tool_approve`, `tool_deny`, `set_mode`, `set_config`

**Configuration** (`flock-core/src/config/settings.rs`):
- Config priority: CLI args/env > project `flock.toml` > global config
- Supports profiles with inheritance (`extends`)
- Provider compatibility settings (`ProviderCompat`) for API differences

### Tauri Desktop UI

**Frontend Stack**:
- React 18 + TypeScript
- Mantine UI v8 (components, notifications)
- Zustand (state management)
- React Query (server state)
- react-markdown + react-syntax-highlighter (message rendering)
- i18next (internationalization)

**State Stores** (`flock-ui/src/store/`):
- `agentStore`: Agent connection status, messages, pending approvals
- `uiStore`: Theme, sidebar state, active view, file tree
- `workspaceStore`: Active workspace/conversation, persisted to localStorage

**Key Views**:
- `HomeView`: Welcome screen, assistant selection, workspace picker
- `WorkspaceView`: Chat panel + file tree + optional preview panel
- `AssistantPage`: CRUD for custom assistants
- `SkillsPage`: Tools, MCP servers, and skills management
- `SettingsModal`: Model providers, basic settings, system settings

**Tauri Commands** (`flock-ui/src-tauri/src/commands/`):
- Agent control: `start_agent`, `stop_agent`, `send_message`, `approve_tool`, `deny_tool`
- Workspace: `list_workspaces`, `create_workspace`, `delete_workspace`
- Conversations: `list_conversations`, `create_conversation`, `load_conversation_history`
- Database: `list_providers`, `upsert_provider`, `list_models`, `upsert_model`
- MCP: `list_mcp_servers`, `upsert_mcp_server`, `test_mcp_server`
- Skills: `list_skills`, `get_extra_skill_dirs`, `add_extra_skill_dir`

### Data Flow

1. User sends message via UI → Tauri command `send_message`
2. `AgentState` forwards to `AgentEngine::run()`
3. Engine builds LangGraph, invokes LLM with tools
4. LLM response streamed as `ProtocolEvent`s via `TauriProtocolEmitter`
5. Frontend `useEventStream` hook listens to Tauri events, updates `agentStore`
6. Tool calls require approval (unless auto-approved) → `ToolApprovalInline` component
7. Approved tools execute → results fed back to LLM for next turn

## Code Style

- Rust edition 2024
- Workspace lints: `unused = "allow"`, `unused_imports = "allow"`
- Error handling: `anyhow` for applications, `thiserror` for libraries
- Async: Tokio runtime throughout
- Frontend: ESLint with TypeScript rules, React hooks plugin
