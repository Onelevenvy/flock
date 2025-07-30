import json
from typing import Any, Optional


def format_tool_response(
    success: bool, data: Optional[Any] = None, error: Optional[str] = None
) -> str:
    """
    格式化工具响应，统一返回格式

    Args:
        success: 工具调用是否成功
        data: 成功时的数据
        error: 失败时的错误信息

    Returns:
        格式化后的JSON字符串
    """
    response = {"success": success}

    if success and data is not None:
        # response["data"] = data
        return data
    elif not success and error is not None:
        response["error"] = error

        return json.dumps(response, ensure_ascii=False)
