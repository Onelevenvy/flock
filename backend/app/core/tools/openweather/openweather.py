import requests
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response
from app.core.tools.tool_manager import get_tool_provider_credential_value


class WeatherSearchInput(BaseModel):
    """Input for the weather search tool."""

    city: str = Field(
        description="city name,please provide city name in English,for example: Beijing"
    )


def open_weather_qry(city: str) -> str:
    """
    invoke tools
    """
    appid = get_tool_provider_credential_value("openweather", "OPEN_WEATHER_API_KEY")

    if not appid:
        return format_tool_response(False, error="OpenWeather API Key is not set.")

    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            "q": city,
            "appid": appid,
            "units": "metric",
            "lang": "zh_cn",
        }
        response = requests.get(url, params=params)

        if response.status_code == 200:
            data = response.json()
            return format_tool_response(True, data)
        else:
            error_message = (
                f"Failed with status code {response.status_code}: {response.text}"
            )
            return format_tool_response(False, error=error_message)

    except Exception as e:
        return format_tool_response(
            False, error=f"OpenWeather API request failed: {str(e)}"
        )


openweather = StructuredTool.from_function(
    func=open_weather_qry,
    name="Open Weather",
    description="Useful for when you need to get weather information. Please provide city name in English.",
    args_schema=WeatherSearchInput,
    return_direct=False,
)
