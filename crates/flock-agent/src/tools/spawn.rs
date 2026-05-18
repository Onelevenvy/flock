use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::spawner::{AgentSpawner, SubAgentConfig};
use flock_core::ipc_interface::events::ToolCategory;
use flock_core::types::tool::{JsonSchema, ToolResult};

use flock_tools::Tool;

const DEFAULT_SUB_AGENT_MAX_TURNS: usize = 200;
const DEFAULT_SUB_AGENT_MAX_TOKENS: u32 = 4096;
const MAX_SUB_AGENTS: usize = 5;

pub struct SpawnTool {
    spawner: Arc<AgentSpawner>,
}

impl SpawnTool {
    pub fn new(spawner: Arc<AgentSpawner>) -> Self {
        Self { spawner }
    }
}

#[async_trait]
impl Tool for SpawnTool {
    fn name(&self) -> &str {
        "Spawn"
    }

    fn description(&self) -> &str {
        "Spawn one or more sub-agents to handle tasks in parallel. \
         Each sub-agent has its own conversation context and tool access.\n\n\
         - Maximum 5 sub-agents per call.\n\
         - Each sub-agent runs up to 200 conversation turns with a 4096 token output limit.\n\
         - Use for independent, parallelizable tasks (e.g., searching different modules, \
         running separate analyses).\n\
         - Do NOT use for tasks that need shared state or sequential coordination."
    }

    fn input_schema(&self) -> JsonSchema {
        json!({
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "description": "List of tasks for sub-agents to execute in parallel",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Short descriptive name for the task"
                            },
                            "prompt": {
                                "type": "string",
                                "description": "The task description / prompt for the sub-agent"
                            }
                        },
                        "required": ["name", "prompt"]
                    }
                }
            },
            "required": ["tasks"]
        })
    }

    fn is_concurrency_safe(&self, _input: &Value) -> bool {
        false // manages its own concurrency
    }

    fn is_deferred(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value) -> ToolResult {
        let tasks = match parse_tasks(&input) {
            Ok(tasks) => tasks,
            Err(e) => {
                return ToolResult {
                    content: e,
                    is_error: true,
                };
            }
        };

        if tasks.is_empty() {
            return ToolResult {
                content: "No tasks provided".to_string(),
                is_error: true,
            };
        }

        if tasks.len() > MAX_SUB_AGENTS {
            return ToolResult {
                content: format!(
                    "Too many sub-agents: {} (max {})",
                    tasks.len(),
                    MAX_SUB_AGENTS
                ),
                is_error: true,
            };
        }

        let results = self.spawner.spawn_parallel(tasks).await;

        let output: Vec<String> = results
            .iter()
            .map(|r| {
                let status = if r.is_error { "ERROR" } else { "OK" };
                format!(
                    "## {} [{}]\n{}\n[turns: {} | tokens: {} in / {} out]",
                    r.name, status, r.text, r.turns, r.usage.input_tokens, r.usage.output_tokens
                )
            })
            .collect();

        let all_error = results.iter().all(|r| r.is_error);

        ToolResult {
            content: output.join("\n\n---\n\n"),
            is_error: all_error,
        }
    }

    fn category(&self) -> ToolCategory {
        ToolCategory::Exec
    }

    fn describe(&self, input: &Value) -> String {
        let task = input
            .get("task")
            .and_then(|v| v.as_str())
            .unwrap_or("sub-agent");
        format!("Spawn: {}", flock_tools::truncate_utf8(task, 80))
    }
}

fn parse_tasks(input: &Value) -> Result<Vec<SubAgentConfig>, String> {
    let tasks_arr = input["tasks"]
        .as_array()
        .ok_or("Missing or invalid 'tasks' array")?;

    let mut configs = Vec::new();
    for task in tasks_arr {
        let name = task["name"]
            .as_str()
            .ok_or("Each task must have a 'name' string")?
            .to_string();
        let prompt = task["prompt"]
            .as_str()
            .ok_or("Each task must have a 'prompt' string")?
            .to_string();

        configs.push(SubAgentConfig {
            name,
            prompt,
            max_turns: DEFAULT_SUB_AGENT_MAX_TURNS,
            max_tokens: DEFAULT_SUB_AGENT_MAX_TOKENS,
            system_prompt: None,
        });
    }

    Ok(configs)
}
