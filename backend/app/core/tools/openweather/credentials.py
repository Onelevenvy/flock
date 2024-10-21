from typing import Any, Dict

OPENWEATHER_CREDENTIALS = {
    "OPEN_WEATHER_API_KEY": {
        "type": "string",
        "description": "API key for OpenWeather service,you can get the api key from https://openweathermap.org/",
        "value": "",  # 初始值为空字符串
    }
}


def get_credentials() -> Dict[str, Any]:
    return OPENWEATHER_CREDENTIALS
