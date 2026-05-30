use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use serde_json::{json, Value as JsonValue};
use regex::Regex;
use langgraph_prebuilt::BaseChatModel;
use flock_core::db::DbManager;
use flock_core::model_factory::{ModelFactory, ModelLlmParams};
use flock_tools::registry::ToolRegistry;
use super::super::state::WorkflowState;
use super::super::variables::{VariableScope, resolve_and_interpolate, resolve_and_interpolate_json};

/// Retry configuration for workflow nodes.
#[derive(Debug, Clone)]
pub struct NodeRetryConfig {
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for NodeRetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 0,
            retry_delay_ms: 1000,
            backoff_multiplier: 2.0,
        }
    }
}

/// Timeout configuration for workflow nodes.
#[derive(Debug, Clone)]
pub struct NodeTimeoutConfig {
    pub timeout_ms: u64,
}

impl Default for NodeTimeoutConfig {
    fn default() -> Self {
        Self {
            timeout_ms: 120_000, // 2 minutes
        }
    }
}

/// Extract retry config from node_data JSON.
pub fn parse_retry_config(node_data: &JsonValue) -> NodeRetryConfig {
    let max_retries = node_data.get("max_retries").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let retry_delay_ms = node_data.get("retry_delay_ms").and_then(|v| v.as_u64()).unwrap_or(1000);
    let backoff_multiplier = node_data.get("backoff_multiplier").and_then(|v| v.as_f64()).unwrap_or(2.0);
    NodeRetryConfig { max_retries, retry_delay_ms, backoff_multiplier }
}

/// Extract timeout config from node_data JSON.
pub fn parse_timeout_config(node_data: &JsonValue) -> NodeTimeoutConfig {
    let timeout_ms = node_data.get("timeout_ms").and_then(|v| v.as_u64()).unwrap_or(120_000);
    NodeTimeoutConfig { timeout_ms }
}

/// Execute an async operation with retry and timeout.
pub async fn execute_with_retry<F, Fut, T>(
    retry: &NodeRetryConfig,
    timeout: &NodeTimeoutConfig,
    f: F,
) -> Result<T, String>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, String>>,
{
    let mut delay = retry.retry_delay_ms;
    let mut last_err = String::new();

    for attempt in 0..=retry.max_retries {
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(timeout.timeout_ms),
            f(),
        )
        .await;

        match result {
            Ok(Ok(val)) => return Ok(val),
            Ok(Err(e)) => {
                last_err = e;
            }
            Err(_) => {
                last_err = format!("timed out after {}ms", timeout.timeout_ms);
            }
        }

        if attempt < retry.max_retries {
            log::warn!(
                "[workflow] Attempt {}/{} failed: {}. Retrying in {}ms...",
                attempt + 1,
                retry.max_retries,
                last_err,
                delay
            );
            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            delay = (delay as f64 * retry.backoff_multiplier) as u64;
        }
    }

    Err(format!("failed after {} retries: {}", retry.max_retries, last_err))
}

/// Output sink for workflow execution
pub trait WorkflowSink: Send + Sync {
    fn emit_node_start(&self, node_id: &str);
    fn emit_node_done(&self, node_id: &str, output: &JsonValue);
    fn emit_text_delta(&self, node_id: &str, text: &str);
    fn emit_thinking(&self, node_id: &str, text: &str);
    fn emit_error(&self, msg: &str);
    fn emit_tool_request(&self, _call_id: &str, _tool_name: &str, _tool_args: &JsonValue) {}
    fn emit_tool_running(&self, _call_id: &str, _tool_name: &str, _tool_args: &JsonValue) {}
    fn emit_tool_result(&self, _call_id: &str, _tool_name: &str, _status: &str, _output: &str) {}
    fn emit_tool_cancelled(&self, _call_id: &str, _tool_name: &str, _reason: &str) {}
}

/// Node execution context
pub struct WorkflowNodeContext {
    pub provider: Arc<dyn BaseChatModel>,
    pub model_factory: Arc<dyn ModelFactory>,
    pub tools: Arc<ToolRegistry>,
    pub db: Arc<DbManager>,
    pub sink: Arc<dyn WorkflowSink>,
    pub debug_mode: bool,
    /// Workflow-level environment variables
    pub env_vars: HashMap<String, JsonValue>,
    /// Workflow ID for system variable resolution
    pub workflow_id: String,
    pub approval_manager: Arc<flock_core::ipc_interface::approval::ToolApprovalManager>,
}

/// Resolve the model for a node: use node-specific model if configured,
/// otherwise fall back to the default provider.
/// Extracts LLM params (temperature, top_p, etc.) from node_data if present.
pub fn resolve_model(node_data: &JsonValue, ctx: &WorkflowNodeContext) -> Arc<dyn BaseChatModel> {
    if let Some(model_name) = node_data.get("model").and_then(|v| v.as_str()) {
        if !model_name.is_empty() {
            let llm_params = ModelLlmParams {
                temperature: node_data.get("temperature").and_then(|v| v.as_f64()).map(|v| v as f32),
                top_p: node_data.get("top_p").and_then(|v| v.as_f64()).map(|v| v as f32),
                frequency_penalty: node_data.get("frequency_penalty").and_then(|v| v.as_f64()).map(|v| v as f32),
                presence_penalty: node_data.get("presence_penalty").and_then(|v| v.as_f64()).map(|v| v as f32),
                max_tokens: node_data.get("max_tokens").and_then(|v| v.as_u64()).map(|v| v as u32),
                json_mode: node_data.get("json_mode").and_then(|v| v.as_bool()).unwrap_or(false),
                json_schema: node_data.get("json_schema").and_then(|v| {
                    if v.is_string() {
                        serde_json::from_str(v.as_str()?).ok()
                    } else if v.is_object() {
                        Some(v.clone())
                    } else {
                        None
                    }
                }),
            };
            match ctx.model_factory.create_with_params(model_name, llm_params) {
                Ok(model) => return model,
                Err(e) => {
                    log::warn!("[workflow] Failed to create model '{}': {}, falling back to default", model_name, e);
                }
            }
        }
    }
    ctx.provider.clone()
}

/// Build the merged env_vars from state and context.
fn build_merged_env(state: &WorkflowState, ctx: &WorkflowNodeContext) -> HashMap<String, JsonValue> {
    let mut merged: HashMap<String, JsonValue> = if let Some(obj) = state.env_vars.as_object() {
        obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    } else {
        HashMap::new()
    };
    for (k, v) in &ctx.env_vars {
        merged.insert(k.clone(), v.clone());
    }
    merged
}

/// Interpolate a template string using the full variable scope (sys.*, env.*, node outputs).
pub fn interpolate_string_with_context(template: &str, state: &WorkflowState, ctx: &WorkflowNodeContext, workflow_id: &str) -> String {
    let system_vars = super::super::variables::build_system_vars(state, workflow_id);
    let merged_env = build_merged_env(state, ctx);
    let scope = VariableScope::new(state, &system_vars, &merged_env);
    resolve_and_interpolate(template, &scope)
}

/// Interpolate a JSON tree using the full variable scope.
pub fn interpolate_json_with_context(val: &JsonValue, state: &WorkflowState, ctx: &WorkflowNodeContext, workflow_id: &str) -> JsonValue {
    let system_vars = super::super::variables::build_system_vars(state, workflow_id);
    let merged_env = build_merged_env(state, ctx);
    let scope = VariableScope::new(state, &system_vars, &merged_env);
    resolve_and_interpolate_json(val, &scope)
}

/// Basic interpolation using only state (no sys/env vars).
/// Kept for backward compatibility with nodes that don't have context access.
pub fn interpolate_string(template: &str, state: &WorkflowState) -> String {
    let empty = HashMap::new();
    let scope = VariableScope::new(state, &empty, &empty);
    resolve_and_interpolate(template, &scope)
}

pub fn interpolate_json(val: &JsonValue, state: &WorkflowState) -> JsonValue {
    let empty = HashMap::new();
    let scope = VariableScope::new(state, &empty, &empty);
    resolve_and_interpolate_json(val, &scope)
}

pub fn parse_state(input: &JsonValue) -> WorkflowState {
    serde_json::from_value(input.clone()).unwrap_or_else(|_| {
        WorkflowState {
            input_msg: String::new(),
            messages: vec![],
            node_outputs: json!({}),
            current_node: String::new(),
            quit_requested: false,
            env_vars: json!({}),
        }
    })
}
