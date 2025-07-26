# This is an example showing how to create a simple calculator skill
from datetime import datetime

import pytz
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response


class TimeZoneInput(BaseModel):
    timezone: str = Field(
        description="Current time zone,Please change to the format of 'tz database', such as 'Beijing time' to 'Asia/Shanghai'"
    )


def get_current_time_cal(timezone: str) -> str:
    try:
        tz = pytz.timezone(timezone)
        current_time = datetime.now(tz)
        formatted_time = current_time.strftime("%A, %B %d, %Y %I:%M %p")
        return format_tool_response(True, formatted_time)
    except Exception as e:
        return format_tool_response(
            False,
            error=f"Error getting current time for timezone '{timezone}': {str(e)}",
        )


get_current_time = StructuredTool.from_function(
    func=get_current_time_cal,
    name="Current Time",
    description=" A tool for obtaining the current time.",
    args_schema=TimeZoneInput,
    return_direct=False,
)
