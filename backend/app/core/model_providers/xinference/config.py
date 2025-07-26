from langchain_openai import ChatOpenAI

from app.db.models import ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "xinference",
    "base_url": "http://192.168.1.189:9997/v1",
    "api_key": "",
    "icon": "xinference_icon",
    "description": "xinference提供的模型",
}

SUPPORTED_MODELS = [
    {
        "name": "qwen2.5-instruct",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "bge-large-zh-v1.5",
        "categories": [ModelCategory.TEXT_EMBEDDING],
        "capabilities": [],
        "dimension": 512,
    },
]


def init_model(model: str, temperature: float, api_key: str, base_url: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=api_key,
            base_url=base_url,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")


# 指定用于鉴权的模型
CREDENTIALS_MODEL_NAME = "qwen2.5-instruct"
