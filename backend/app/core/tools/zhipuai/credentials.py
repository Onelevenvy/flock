from typing import Any

ZHIPUAI_CREDENTIALS = {
    "ZHIPUAI_API_KEY": {
        "type": "string",
        "value": "",
        "description": "API key for zhipuai service, you can get the api key from https://open.zhipuai.cn/",
    }
}


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "智谱AI提供的一系列AI能力工具，包括图像理解、对话助手、网络搜索等功能",
        "icon": "zhipuai",
        "display_name": "智谱AI",
    }


def get_credentials() -> dict[str, Any]:
    return ZHIPUAI_CREDENTIALS


def credentials_function() -> dict[str, Any]:
    return {
        "tool_name": "websearch",
        "input_parameters": {
            "query": "What is the latest news of China?",
        },
    }
