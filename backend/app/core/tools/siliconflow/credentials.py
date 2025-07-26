from typing import Any

SILICONFLOW_CREDENTIALS = {
    "SILICONFLOW_API_KEY": {
        "type": "string",
        "description": "API key for Silicon Flow service",
        "value": "",
    }
}


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "SiliconFlow提供的工具集合，包含文生图、文生视频等工具",
        "icon": "siliconflow",
        "display_name": "SiliconFlow",
    }


def get_credentials() -> dict[str, Any]:
    return SILICONFLOW_CREDENTIALS


def credentials_function() -> dict[str, Any]:
    """返回用于测试工具的参数

    Returns:
        dict: 包含工具名称和测试参数的字典
    """
    return {
        "tool_name": "siliconflow_img_generation",
        "input_parameters": {
            "prompt": "A beautiful sunset over the ocean",
        },
    }
