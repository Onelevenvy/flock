from langchain_openai import ChatOpenAI

from app.db.models import ModelCapability, ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "302.AI",
    "base_url": " https://api.302.ai/v1",
    "api_key": "",
    "icon": "302AI_icon",
    "description": "302.AI 提供的模型",
}

SUPPORTED_MODELS = [
    {
        "name": "glm-4.5-flash",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "Qwen/Qwen3-8B",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "qwen-vl-plus-latest",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
    {
        "name": "claude-sonnet-4-20250514",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
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
CREDENTIALS_MODEL_NAME = "glm-4.5-flash"
