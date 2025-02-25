from app.core.tools.tool_invoker import invoke_tool
from langchain_core.runnables import RunnableConfig

from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)


class PluginNode:
    def __init__(self, node_id: str, tool_name: str, args: dict):
        self.node_id = node_id
        self.tool_name = tool_name
        self.args = args

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        if self.args:
            parsed_tool_args = parse_variables(
                self.args, state["node_outputs"]
            )
            tool_result = invoke_tool(self.tool_name, parsed_tool_args)
        else:
            tool_result = invoke_tool(self.tool_name, {})

        new_output = {self.node_id: tool_result}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowTeamState = {
            "node_outputs": state["node_outputs"],
        }

        return return_state