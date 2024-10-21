from typing import Any, Dict

SPARK_CREDENTIALS = {
    "SPARK_APPID": {
        "type": "string",
        "description": "App ID for Spark service",
        "value": "",
    },
    "SPARK_APISECRET": {
        "type": "string",
        "description": "API Secret for Spark service",
        "value": "",
    },
    "SPARK_APIKEY": {
        "type": "string",
        "description": "API Key for Spark service",
        "value": "",
    },
}


def get_credentials() -> Dict[str, Any]:
    return SPARK_CREDENTIALS
