from typing import Any

OPENWEATHER_CREDENTIALS = {
    "OPEN_WEATHER_API_KEY": {
        "type": "string",
        "value": "",
        "description": "API key for OpenWeather service,you can get the api key from https://openweathermap.org/",
    }
}


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "OpenWeather提供的天气查询工具，支持全球城市的天气信息查询，包括温度、湿度、风速等数据",
        "icon": "openweather",
        "display_name": "Open Weather",
    }


def get_credentials() -> dict[str, Any]:
    return OPENWEATHER_CREDENTIALS


def credentials_function() -> dict[str, Any]:
    return {
        "tool_name": "openweather",
        "input_parameters": {
            "city": "Beijing",
        },
    }
