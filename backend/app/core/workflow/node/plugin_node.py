import ast
import json

from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableConfig

from app.core.state import (ReturnWorkflowState, WorkflowState,
                            parse_variables, update_node_outputs)
from app.core.tools.tool_invoker import ToolInvokeResponse, invoke_tool


def clean_dict_values(data):
    """
    Recursively cleans all string values in a dictionary or list
    by replacing non-breaking spaces ('\xa0') with regular spaces
    and stripping leading/trailing whitespace.
    """
    if isinstance(data, dict):
        # 如果是字典，递归清洗它的每一个值
        return {k: clean_dict_values(v) for k, v in data.items()}
    elif isinstance(data, list):
        # 如果是列表，递归清洗它的每一个元素
        return [clean_dict_values(elem) for elem in data]
    elif isinstance(data, str):
        # 如果是字符串，执行替换和strip操作
        return data.replace("\xa0", " ").strip()
    else:
        # 对于其他类型（如int, float, bool, None），保持原样
        return data


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
    def __init__(self, node_id: str, tool_data: dict, args: dict):
        self.node_id = node_id
        self.tool_data = tool_data
        self.args = args

    async def work(
        self, state: WorkflowState, config: RunnableConfig
    ) -> ReturnWorkflowState:
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        if self.args:
            parsed_tool_args = parse_variables(self.args, state["node_outputs"])
            temp_dict = convert_str_to_dict(parsed_tool_args)
            parsed_tool_args_dict = clean_dict_values(temp_dict)
            tool_result = await invoke_tool(
                self.tool_data["id"], self.tool_data["name"], parsed_tool_args_dict
            )
        else:
            tool_result = ToolInvokeResponse(
                messages=[
                    ToolMessage(
                        content="No args provided",
                        name=self.tool_data["name"],
                        tool_call_id="",
                    )
                ],
                error="No args provided",
            )

        new_output = {self.node_id: {"response": tool_result.messages[0].content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowState = {
            "messages": tool_result.messages,
            "node_outputs": state["node_outputs"],
        }

        return return_state
