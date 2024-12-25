from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig

from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)


class AnswerNode:
    def __init__(self, node_id: str, input_schema: str):
        self.node_id = node_id
        self.input_schema = input_schema

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        if self.input_schema:
            parsed_input_schema = parse_variables(
                self.input_schema, state["node_outputs"]
            )
            result = AIMessage(content=parsed_input_schema)
        else:
            messages = state.get("all_messages", [])
            result = AIMessage(
                content=messages[-1].content if messages else "No answer available."
            )

        # 更新 node_outputs
        new_output = {self.node_id: {"response": result.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)
        return_state: ReturnWorkflowTeamState = {
            "history": state.get("history", []) + [result],
            "messages": [result],
            "all_messages": state.get("all_messages", []) + [result],
            "node_outputs": state["node_outputs"],
        }
        return return_state
