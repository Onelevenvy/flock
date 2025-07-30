from typing import Any

BAIDU_CREDENTIALS = {
    "BAIDU_APPID": {
        "type": "string",
        "value": "",
        "description": "App ID for Baidu service",
    },
    "BAIDU_SECRETKEY": {
        "type": "string",
        "value": "",
        "description": "secretKey for Baidu service",
    },
}


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {"description": "百度工具集合", "icon": "baidu", "display_name": "百度"}


def get_credentials() -> dict[str, Any]:
    return BAIDU_CREDENTIALS


def credentials_function() -> dict[str, Any]:
    """返回用于测试工具的参数

    Returns:
        dict: 包含工具名称和测试参数的字典
    """
    return {
        "tool_name": "baidutranslate",
        "input_parameters": {
            "content": "Hello, world!",
            "dest": "zh",
        },
    }
