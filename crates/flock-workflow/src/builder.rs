//! Graph builder for the flock workflow agent.

use std::sync::Arc;
use std::collections::HashMap;
use langgraph::graph::{CompiledStateGraph, GraphError, StateGraph};
use langgraph::prelude::*;
use langgraph::runnable::RoutingFn;
use langgraph::checkpoint::BaseCheckpointSaver;
use serde_json::Value as JsonValue;

use super::state::WorkflowState;
use super::nodes::{
    make_start_node,
    make_llm_workflow_node,
    make_agent_workflow_node,
    make_classifier_node,
    make_ifelse_node,
    make_answer_node,
    make_code_node,
    make_human_node,
    make_plugin_node,
    make_parameter_extractor_node,
    WorkflowNodeContext,
};

/// Helper to parse input state
fn parse_state(input: &JsonValue) -> WorkflowState {
    serde_json::from_value(input.clone()).unwrap_or_else(|_| {
        WorkflowState {
            input_msg: String::new(),
            messages: vec![],
            node_outputs: serde_json::json!({}),
            current_node: String::new(),
            quit_requested: false,
            env_vars: serde_json::json!({}),
        }
    })
}

/// Build and compile the workflow execution graph dynamically from ReactFlow JSON config.
pub fn build_workflow_graph(
    config: &JsonValue,
    ctx: Arc<WorkflowNodeContext>,
    checkpointer: Arc<dyn BaseCheckpointSaver>,
) -> Result<CompiledStateGraph, GraphError> {
    let nodes = config.get("nodes")
        .and_then(|v| v.as_array())
        .ok_or_else(|| GraphError::ValidationError("No nodes found in workflow config".to_string()))?;

    let edges = config.get("edges")
        .and_then(|v| v.as_array())
        .ok_or_else(|| GraphError::ValidationError("No edges found in workflow config".to_string()))?;

    let channels = WorkflowState::create_channels();
    let mut graph = StateGraph::new(channels);

    // ── 1. Register Nodes ──────────────────────────────────────────────────
    let mut start_node_id = None;
    let mut end_node_id = None;
    let mut conditional_node_ids = Vec::new();
    let mut node_types = HashMap::new();

    for node in nodes {
        let id = node.get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| GraphError::ValidationError("Node missing id".to_string()))?
            .to_string();

        let ntype = node.get("type").and_then(|v| v.as_str()).unwrap_or("llm");
        let data = node.get("data").cloned().unwrap_or_else(|| serde_json::json!({}));
        node_types.insert(id.clone(), ntype.to_string());

        match ntype {
            "start" => {
                start_node_id = Some(id.clone());
                graph.add_node(&id, make_start_node(id.clone(), ctx.clone()))?;
            }
            "end" => {
                end_node_id = Some(id.clone());
                let id_clone = id.clone();
                let ctx_clone = ctx.clone();
                graph.add_node(&id, move |input: JsonValue, _config| {
                    let node_id = id_clone.clone();
                    let ctx_clone = ctx_clone.clone();
                    Box::pin(async move {
                        ctx_clone.sink.emit_node_start(&node_id);
                        ctx_clone.sink.emit_node_done(&node_id, &serde_json::json!({}));
                        Ok(serde_json::json!({}))
                    })
                })?;
            }
            "llm" => {
                graph.add_node(&id, make_llm_workflow_node(id.clone(), data, ctx.clone()))?;
            }
            "agent" => {
                graph.add_node(&id, make_agent_workflow_node(id.clone(), data, ctx.clone()))?;
            }
            "classifier" => {
                conditional_node_ids.push(id.clone());
                graph.add_node(&id, make_classifier_node(id.clone(), data, ctx.clone()))?;
            }
            "ifelse" => {
                conditional_node_ids.push(id.clone());
                graph.add_node(&id, make_ifelse_node(id.clone(), data, ctx.clone()))?;
            }
            "answer" => {
                graph.add_node(&id, make_answer_node(id.clone(), data, ctx.clone()))?;
            }
            "code" => {
                graph.add_node(&id, make_code_node(id.clone(), data, ctx.clone()))?;
            }
            "human" => {
                conditional_node_ids.push(id.clone());
                graph.add_node(&id, make_human_node(id.clone(), data, ctx.clone()))?;
            }
            "plugin" => {
                graph.add_node(&id, make_plugin_node(id.clone(), data, ctx.clone()))?;
            }
            "parameterExtractor" => {
                graph.add_node(&id, make_parameter_extractor_node(id.clone(), data, ctx.clone()))?;
            }
            _ => {
                return Err(GraphError::ValidationError(format!("Unknown node type: {}", ntype)));
            }
        }
    }

    let start_node = start_node_id.ok_or_else(|| {
        GraphError::ValidationError("Workflow config must contain a start node".to_string())
    })?;

    // Entry point is start node
    graph.add_edge(START, &start_node)?;

    if let Some(ref end_id) = end_node_id {
        graph.add_edge(end_id, END)?;
    }

    // ── 2. Register Edges ──────────────────────────────────────────────────
    // Group edges by source
    let mut edge_groups: HashMap<String, Vec<JsonValue>> = HashMap::new();
    for edge in edges {
        if let Some(source) = edge.get("source").and_then(|v| v.as_str()) {
            edge_groups.entry(source.to_string()).or_default().push(edge.clone());
        }
    }

    for (source, source_edges) in edge_groups {
        if conditional_node_ids.contains(&source) {
            // Conditional routing
            let source_clone = source.clone();
            let node_types_clone = node_types.clone();
            let route_fn = RoutingFn(move |input: &JsonValue| {
                let state = parse_state(input);
                if let Some(node_out) = state.node_outputs.get(&source_clone) {
                    if let Some(ntype) = node_types_clone.get(&source_clone) {
                        match ntype.as_str() {
                            "human" => {
                                if let Some(choice) = node_out.get("choice").and_then(|v| v.as_str()) {
                                    return choice.to_string();
                                }
                                return "TIMEOUT".to_string();
                            }
                            "ifelse" => {
                                if let Some(c) = node_out.get("case_id").and_then(|v| v.as_str()) {
                                    return c.to_string();
                                }
                            }
                            "classifier" => {
                                if let Some(cat) = node_out.get("category_id").and_then(|v| v.as_str()) {
                                    return cat.to_string();
                                }
                            }
                            _ => {}
                        }
                    }
                }
                
                // Fallback based on node type
                if let Some(ntype) = node_types_clone.get(&source_clone) {
                    if ntype == "ifelse" {
                        "false_else".to_string()
                    } else {
                        "others_category".to_string()
                    }
                } else {
                    "others_category".to_string()
                }
            });

            let mut path_map = HashMap::new();
            for edge in source_edges {
                let handle = edge.get("sourceHandle").and_then(|v| v.as_str()).unwrap_or("");
                let target = edge.get("target").and_then(|v| v.as_str()).unwrap_or("");
                if !handle.is_empty() && !target.is_empty() {
                    path_map.insert(handle.to_string(), target.to_string());
                }
            }

            graph.add_conditional_edges(&source, route_fn, Some(path_map))?;
        } else {
            // Normal routing: a standard node usually has only 1 successor port,
            // but if there are multiple, route all of them.
            for edge in source_edges {
                let target = edge.get("target").and_then(|v| v.as_str()).unwrap_or("");
                if !target.is_empty() {
                    graph.add_edge(&source, target)?;
                }
            }
        }
    }

    // ── 3. Compile ─────────────────────────────────────────────────────────
    let compiled = graph
        .compile_builder()
        .checkpointer(checkpointer)
        .build()?;

    Ok(compiled)
}

/// Build a single-node graph for debugging a specific node in isolation.
/// Creates: START → [debug node] → END
pub fn build_debug_node_graph(
    config: &JsonValue,
    node_id: &str,
    ctx: Arc<WorkflowNodeContext>,
    checkpointer: Arc<dyn BaseCheckpointSaver>,
) -> Result<CompiledStateGraph, GraphError> {
    let nodes = config.get("nodes")
        .and_then(|v| v.as_array())
        .ok_or_else(|| GraphError::ValidationError("No nodes found in workflow config".to_string()))?;

    // Find the target node
    let target_node = nodes.iter()
        .find(|n| n.get("id").and_then(|v| v.as_str()) == Some(node_id))
        .ok_or_else(|| GraphError::ValidationError(format!("Node '{}' not found in workflow config", node_id)))?;

    let ntype = target_node.get("type").and_then(|v| v.as_str()).unwrap_or("llm");
    let data = target_node.get("data").cloned().unwrap_or_else(|| serde_json::json!({}));

    let channels = WorkflowState::create_channels();
    let mut graph = StateGraph::new(channels);

    // Register a synthetic start node
    let start_id = "__debug_start";
    let ctx_start = ctx.clone();
    graph.add_node(start_id, move |input: JsonValue, _config: RunnableConfig| {
        let ctx = ctx_start.clone();
        Box::pin(async move {
            ctx.sink.emit_node_start("__debug_start");
            ctx.sink.emit_node_done("__debug_start", &serde_json::json!({}));
            Ok(input)
        })
    })?;

    // Register the target node
    let debug_node_id = format!("__debug_{}", node_id);
    match ntype {
        "llm" => { graph.add_node(&debug_node_id, make_llm_workflow_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "agent" => { graph.add_node(&debug_node_id, make_agent_workflow_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "classifier" => { graph.add_node(&debug_node_id, make_classifier_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "ifelse" => { graph.add_node(&debug_node_id, make_ifelse_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "answer" => { graph.add_node(&debug_node_id, make_answer_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "code" => { graph.add_node(&debug_node_id, make_code_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "human" => { graph.add_node(&debug_node_id, make_human_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "plugin" => { graph.add_node(&debug_node_id, make_plugin_node(debug_node_id.clone(), data, ctx.clone()))?; }
        "parameterExtractor" => { graph.add_node(&debug_node_id, make_parameter_extractor_node(debug_node_id.clone(), data, ctx.clone()))?; }
        _ => return Err(GraphError::ValidationError(format!("Cannot debug node type: {}", ntype))),
    }

    // Register a synthetic end node
    let end_id = "__debug_end";
    let ctx_end = ctx.clone();
    graph.add_node(end_id, move |input: JsonValue, _config: RunnableConfig| {
        let ctx = ctx_end.clone();
        Box::pin(async move {
            ctx.sink.emit_node_start("__debug_end");
            ctx.sink.emit_node_done("__debug_end", &serde_json::json!({}));
            Ok(input)
        })
    })?;

    // Wire: START → start → target → end → END
    graph.add_edge(START, start_id)?;
    graph.add_edge(start_id, &debug_node_id)?;
    graph.add_edge(&debug_node_id, end_id)?;
    graph.add_edge(end_id, END)?;

    let compiled = graph
        .compile_builder()
        .checkpointer(checkpointer)
        .build()?;

    Ok(compiled)
}
