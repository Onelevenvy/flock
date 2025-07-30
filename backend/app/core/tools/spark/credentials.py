from typing import Any

SPARK_CREDENTIALS = {
    "SPARK_APPID": {
        "type": "string",
        "value": "",
        "description": "App ID for Spark service",
    },
    "SPARK_APIKEY": {
        "type": "string",
        "value": "",
        "description": "API Key for Spark service",
    },
    "SPARK_APISECRET": {
        "type": "string",
        "value": "",
        "description": "API Secret for Spark service",
    },
}


def get_provider_info() -> dict[str, str]:
    """返回工具集的描述信息"""
    return {
        "description": "讯飞星火认知大模型提供的AI能力工具集，包括图像生成等功能",
        "icon": "spark",
        "display_name": "讯飞星火",
    }


def get_credentials() -> dict[str, Any]:
    return SPARK_CREDENTIALS


def credentials_function() -> dict[str, Any]:
    return {
        "tool_name": "spark_img_generation",
        "input_parameters": {
            "prompt": "A beautiful girl",
        },
    }
