from typing import Any

SILICONFLOW_CREDENTIALS = {
    "SILICONFLOW_API_KEY": {
        "type": "string",
        "description": "API key for Silicon Flow service",
        "value": "",
    }
}


def get_credentials() -> dict[str, Any]:
    return SILICONFLOW_CREDENTIALS
