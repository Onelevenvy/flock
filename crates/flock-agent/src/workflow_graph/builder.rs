//! Graph builder for the flock workflow agent.

use std::sync::Arc;
use std::collections::HashMap;
use langgraph::graph::{CompiledStateGraph, GraphError, StateGraph};
use langgraph::prelude::*;
use langgraph::runnable::RoutingFn;
use langgraph_checkpoint::checkpoint::base::BaseCheckpointSaver;
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

    for node in nodes {
        let id = node.get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| GraphError::ValidationError("Node missing id".to_string()))?
            .to_string();

        let ntype = node.get("type").and_then(|v| v.as_str()).unwrap_or("llm");
        let data = node.get("data").cloned().unwrap_or_else(|| serde_json::json!({}));

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
            let is_ifelse = source_edges.first()
                .and_then(|e| e.get("sourceHandle").and_then(|h| h.as_str()))
                .map(|h| h != "others_category")
                .unwrap_or(true); // check classifier vs ifelse

            let source_clone = source.clone();
            let route_fn = RoutingFn(move |input: &JsonValue| {
                let state = parse_state(input);
                if let Some(node_out) = state.node_outputs.get(&source_clone) {
                    if is_ifelse {
                        if let Some(c) = node_out.get("case_id").and_then(|v| v.as_str()) {
                            return c.to_string();
                        }
                    } else {
                        if let Some(cat) = node_out.get("category_id").and_then(|v| v.as_str()) {
                            return cat.to_string();
                        }
                    }
                }
                if is_ifelse { "false_else".to_string() } else { "others_category".to_string() }
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
