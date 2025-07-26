from typing import Any


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "获取当前时间",
        "icon": "get_current_time",
        "display_name": "获取当前时间",
    }


def get_credentials() -> dict[str, Any]:
    return {}
