from typing import Any


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "用于在AI执行任务过程中获取用户批准，或者请求额外的输入",
        "icon": "ask_human",
        "display_name": "Ask Human",
    }


def get_credentials() -> dict[str, Any]:
    return {}
