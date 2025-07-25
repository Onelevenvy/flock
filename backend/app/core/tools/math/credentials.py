# This is an example showing how to create a simple calculator skill

import numexpr as ne
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response


class MathInput(BaseModel):
    expression: str = Field(description="Math Expression")


def math_cal(expression: str) -> str:
    try:
        result = ne.evaluate(expression)
        result_str = str(result)
        return format_tool_response(True, result_str)
    except Exception as e:
        return format_tool_response(
            False, error=f"Error evaluating expression '{expression}': {str(e)}"
        )


math = StructuredTool.from_function(
    func=math_cal,
    name="Math Calculator",
    description=" A tool for evaluating an math expression, calculated locally with NumExpr.",
    args_schema=MathInput,
    return_direct=False,
)
