from typing import Any

SERPER_CREDENTIALS = {
    "SERPER_API_KEY": {
        "type": "string",
        "description": (
            "API key for Serper service,you can get the api key from https://serper.dev/"
        ),
        "value": "",  # 初始值为空字符串
    }
}


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "Serper提供的工具，支持全球的搜索",
        "icon": "serper",
        "display_name": "Serper",
    }


def get_credentials() -> dict[str, Any]:
    return SERPER_CREDENTIALS


def credentials_function() -> dict[str, Any]:
    return {
        "tool_name": "serper",
        "input_parameters": {
            "search_query": "What is the latest news of China?",
        },
    }
