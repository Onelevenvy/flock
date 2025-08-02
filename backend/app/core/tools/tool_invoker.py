# 导入自定义响应模型
import json
import uuid

from langchain.tools import BaseTool
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel

from app.core.tools.response_formatter import format_tool_response
from app.core.tools.tool_manager import get_tool_by_tool_id


class ToolInvokeResponse(BaseModel):
    messages: list[ToolMessage]
    error: str | None = None  # 可选的错误信息


def format_and_invoke_tool(tool: BaseTool, **kwargs) -> str:
    """
    调用工具并处理异常，返回统一格式的响应

    Args:
        tool: 要调用的工具
        **kwargs: 工具调用参数

    Returns:
        格式化后的工具调用结果
    """
    try:
        result = tool.invoke(kwargs)
        # 尝试解析结果，看是否已经是格式化的JSON
        try:
            parsed_result = json.loads(result)
            if isinstance(parsed_result, dict) and "success" in parsed_result:
                # 已经是格式化的响应
                return result
            else:
                # 结果是JSON但不是标准格式，包装为成功响应
                return format_tool_response(True, parsed_result)
        except (json.JSONDecodeError, TypeError):
            # 不是JSON格式，包装为成功响应
            return format_tool_response(True, result)
    except Exception as e:
        # 发生异常，包装为失败响应
        return format_tool_response(False, error=str(e))


async def invoke_tool(tool_id: int, tool_name: str, args: dict) -> ToolInvokeResponse:
    """
    Invoke a tool by name with the provided arguments.

    Args:
        tool_id: tool id
        tool_name: 工具名称，
        args: 工具调用参数

    Returns:
        ToolInvokeResponse: 工具调用响应
    """

    if not tool_id:
        return ToolInvokeResponse(
            messages=[],
            error=f"Invalid tool,tool id : {tool_id},tool name : {tool_name}",
        )

    tool_call_id = str(uuid.uuid4())

    # Create the AIMessage for the tool call
    message_with_tool_call = AIMessage(
        content="",
        tool_calls=[
            {
                "name": tool_name,  # 使用简单名称作为显示名称
                "args": args,
                "id": tool_call_id,
                "type": "tool_call",
            }
        ],
    )

    try:

        tool_node = ToolNode(tools=[await get_tool_by_tool_id(tool_id)])
        result = await tool_node.ainvoke({"messages": [message_with_tool_call]})
        messages = [
            ToolMessage(
                content=msg.content,
                name=msg.name,
                tool_call_id=msg.tool_call_id,
            )
            for msg in result["messages"]
        ]
        return ToolInvokeResponse(messages=messages)

    except Exception as e:
        # 返回易于识别的错误信息
        return ToolInvokeResponse(messages=[], error=str(e))
