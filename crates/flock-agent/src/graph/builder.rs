//! Graph builder for the flock agent.

use std::sync::Arc;

use langgraph::graph::{CompiledStateGraph, GraphError, StateGraph};
use langgraph::prelude::*;
use langgraph::checkpoint::checkpoint::base::BaseCheckpointSaver;

use super::nodes::{
    make_compaction_node,
    make_llm_node,
    route_after_llm,
    route_after_tools,
    NodeContext,
};
use super::state::AgentState;
use super::tool_node::FlockToolNode;

/// Build and compile the agent execution graph.
///
/// Graph topology:
/// ```text
/// START → compaction → llm ─┬─► tools ─► (back to compaction)
///                            │    ↑ interrupt_before
///                            └─► END  (no tool calls / max turns)
/// ```
///
/// The `tools` node has `interrupt_before` set, so the graph pauses before
/// executing tools. The engine handles approval and resumes with a decision.
///
/// `checkpointer` is created externally (e.g. `SqliteSaver` or `InMemorySaver`)
/// and passed in so that this function remains sync and the saver can be
/// shared / reused across multiple invocations.
pub fn build_agent_graph(
    ctx: Arc<NodeContext>,
    checkpointer: Arc<dyn BaseCheckpointSaver>,
) -> Result<CompiledStateGraph, GraphError> {
    let channels = AgentState::create_channels();
    let mut graph = StateGraph::new(channels);

    // ── Nodes ──────────────────────────────────────────────────────────────

    let ctx1 = Arc::clone(&ctx);
    graph.add_node("compaction", make_compaction_node(ctx1))?;

    let ctx2 = Arc::clone(&ctx);
    graph.add_node("llm", make_llm_node(ctx2))?;

    let ctx3 = Arc::clone(&ctx);
    let tools_node: Arc<dyn langgraph::runnable::Runnable> = Arc::new(FlockToolNode::new(ctx3));
    graph.add_node("tools", tools_node)?;

    // ── Edges ──────────────────────────────────────────────────────────────

    graph.add_edge(START, "compaction")?;
    graph.add_edge("compaction", "llm")?;

    conditional_edges!(
        graph, "llm", route_after_llm,
        "tools" => "tools", END => END
    )?;

    conditional_edges!(
        graph, "tools", route_after_tools,
        "compaction" => "compaction", END => END
    )?;

    // ── Compile ────────────────────────────────────────────────────────────

    // No interrupt_before needed — FlockToolNode calls interrupt() internally
    // when approval is needed, following the same pattern as the examples.
    let compiled = graph
        .compile_builder()
        .checkpointer(checkpointer)
        .build()?;

    Ok(compiled)
}
