from typing import Any

SERPER_CREDENTIALS = {
    "SERPER_API_KEY": {
        "type": "string",
        "description": "API key for Serper service,you can get the api key from https://serper.dev/",
        "value": "",  # 初始值为空字符串
    }
}


def get_credentials() -> dict[str, Any]:
    return SERPER_CREDENTIALS
