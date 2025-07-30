from typing import Any


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "Google 工具集合",
        "icon": "google",
        "display_name": "Google",
    }


def get_credentials() -> dict[str, Any]:
    return {}
