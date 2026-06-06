use std::sync::Arc;

use async_trait::async_trait;

use flock_core::config::settings::Config;
use flock_core::types::message::TokenUsage;
use flock_tools::builtin::bash::BashTool;
use flock_tools::builtin::edit::EditTool;
use flock_tools::builtin::glob::GlobTool;
use flock_tools::builtin::grep::GrepTool;
use flock_tools::builtin::read::ReadTool;
use flock_tools::builtin::write::WriteTool;
use flock_tools::registry::ToolRegistry;
use langgraph::prebuilt::BaseChatModel;

use crate::engine::AgentEngine;
use crate::sinks::null_sink::NullSink;
use crate::sinks::OutputSink;

// Re-export from flock-types — single source of truth
pub use flock_core::types::spawner::{ForkOverrides, Spawner, SubAgentConfig, SubAgentResult};

/// Spawns independent child agents that share the parent's LLM provider.
///
/// Sub-agents use a [`NullSink`] so their streaming output is silently
/// discarded.  Results are collected via `engine.run()` and returned to the
/// parent which emits them as a single `tool_result` event — matching the
/// Claude Code pattern where only the parent writes to stdout.
pub struct AgentSpawner {
    provider: Arc<dyn BaseChatModel>,
    base_config: Config,
}

impl AgentSpawner {
    pub fn new(provider: Arc<dyn BaseChatModel>, config: Config) -> Self {
        Self {
            provider,
            base_config: config,
        }
    }

    /// Spawn a single sub-agent and wait for result.
    pub async fn spawn_one(&self, sub_config: SubAgentConfig) -> SubAgentResult {
        let mut config = self.base_config.clone();
        config.max_turns = Some(sub_config.max_turns);
        config.max_tokens = sub_config.max_tokens;
        if let Some(sp) = sub_config.system_prompt.clone() {
            config.system_prompt = Some(sp);
        }
        config.session.enabled = false;
        config.tools.auto_approve = true;

        let tools = build_tool_registry(&[]);
        let output: Arc<dyn OutputSink> = Arc::new(NullSink);
        let mut engine =
            AgentEngine::new_with_provider(self.provider.clone(), config, tools, output).await;

        match engine.run(&sub_config.prompt, "").await {
            Ok(result) => SubAgentResult {
                name: sub_config.name,
                text: result.text,
                usage: result.usage,
                turns: result.turns,
                is_error: false,
            },
            Err(e) => SubAgentResult {
                name: sub_config.name,
                text: format!("Sub-agent error: {}", e),
                usage: TokenUsage::default(),
                turns: 0,
                is_error: true,
            },
        }
    }

    /// Spawn multiple sub-agents in parallel.
    pub async fn spawn_parallel(&self, sub_configs: Vec<SubAgentConfig>) -> Vec<SubAgentResult> {
        let futures: Vec<_> = sub_configs
            .into_iter()
            .map(|config| {
                let spawner = self.clone_for_spawn();
                tokio::spawn(async move { spawner.spawn_one(config).await })
            })
            .collect();

        let mut results = Vec::new();
        for future in futures {
            match future.await {
                Ok(result) => results.push(result),
                Err(e) => results.push(SubAgentResult {
                    name: "unknown".to_string(),
                    text: format!("Task join error: {}", e),
                    usage: TokenUsage::default(),
                    turns: 0,
                    is_error: true,
                }),
            }
        }
        results
    }

    fn clone_for_spawn(&self) -> Self {
        Self {
            provider: self.provider.clone(),
            base_config: self.base_config.clone(),
        }
    }
}

#[async_trait]
impl Spawner for AgentSpawner {
    async fn spawn_fork(
        &self,
        sub_config: SubAgentConfig,
        overrides: ForkOverrides,
    ) -> SubAgentResult {
        let mut config = self.base_config.clone();
        config.max_turns = Some(sub_config.max_turns);
        config.max_tokens = sub_config.max_tokens;
        if let Some(sp) = sub_config.system_prompt.clone() {
            config.system_prompt = Some(sp);
        }
        config.session.enabled = false;
        config.tools.auto_approve = true;
        if let Some(model) = overrides.model.clone() {
            config.model = model;
        }

        let tools = build_tool_registry(&overrides.allowed_tools);
        let output: Arc<dyn OutputSink> = Arc::new(NullSink);
        let mut engine =
            AgentEngine::new_with_provider(self.provider.clone(), config, tools, output).await;
        engine.set_initial_reasoning_effort(overrides.effort.clone());

        match engine.run(&sub_config.prompt, "").await {
            Ok(result) => SubAgentResult {
                name: sub_config.name,
                text: result.text,
                usage: result.usage,
                turns: result.turns,
                is_error: false,
            },
            Err(e) => SubAgentResult {
                name: sub_config.name,
                text: format!("Sub-agent error: {}", e),
                usage: TokenUsage::default(),
                turns: 0,
                is_error: true,
            },
        }
    }
}

type ToolFactory = fn() -> Box<dyn flock_tools::Tool>;

fn build_tool_registry(allowed: &[String]) -> ToolRegistry {
    let all: &[(&str, ToolFactory)] = &[
        ("Read", || ReadTool::new()),
        ("Write", || WriteTool::new()),
        ("Edit", || EditTool::new()),
        ("Bash", || BashTool::new()),
        ("Grep", || GrepTool::new()),
        ("Glob", || GlobTool::new()),
    ];

    let mut registry = ToolRegistry::new();
    for (name, make_tool) in all {
        if allowed.is_empty() || allowed.iter().any(|a| a.as_str() == *name) {
            registry.register(make_tool());
        }
    }
    registry
}

