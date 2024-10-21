from typing import Any, Dict

SILICONFLOW_CREDENTIALS = {
    "SILICONFLOW_API_KEY": {
        "type": "string",
        "description": "API key for Silicon Flow service",
        "value": "",
    }
}


def get_credentials() -> Dict[str, Any]:
    return SILICONFLOW_CREDENTIALS
