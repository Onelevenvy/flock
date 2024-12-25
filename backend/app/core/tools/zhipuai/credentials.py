from typing import Any

ZHIPUAI_CREDENTIALS = {
    "ZHIPUAI_API_KEY": {
        "type": "string",
        "description": "API key for zhipuai",
        "value": "",
    }
}


def get_credentials() -> dict[str, Any]:

    return ZHIPUAI_CREDENTIALS
