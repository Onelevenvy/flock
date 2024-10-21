from .state import TeamState


def InputNode(state: TeamState):
    if "node_outputs" not in state:
        state["node_outputs"] = {}
    if isinstance(state, list):
        human_message = state[-1].content
    elif messages := state.get("all_messages", []):
        human_message = messages[-1].content
    inputnode_outputs = {"start": {"query": human_message}}
    state["node_outputs"] = inputnode_outputs
    return state
