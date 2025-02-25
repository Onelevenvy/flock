import ast
import json

from langchain_core.runnables import RunnableConfig

from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)
from app.core.tools.tool_invoker import ToolInvokeResponse, ToolMessages, invoke_tool


def convert_str_to_dict(s: str) -> dict:
    """Convert a string representation of a Python dictionary to a dictionary object."""
    try:
        # First try json.loads
        return json.loads(s)
    except json.JSONDecodeError:
        try:
            # If json.loads fails, try ast.literal_eval
            return ast.literal_eval(s)
        except (ValueError, SyntaxError):
            raise ValueError(f"Failed to convert string to dictionary: {s}")


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
            parsed_tool_args = parse_variables(self.args, state["node_outputs"])
            parsed_tool_args_dict = convert_str_to_dict(parsed_tool_args)
            tool_result = invoke_tool(self.tool_name, parsed_tool_args_dict)
        else:
            tool_result = ToolInvokeResponse(
                messages=[
                    ToolMessages(
                        content="No args provided", name=self.tool_name, tool_call_id=""
                    )
                ],
                error="No args provided",
            )

        new_output = {self.node_id: {"response": tool_result.messages[0].content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowTeamState = {
            "node_outputs": state["node_outputs"],
        }

        return return_state
