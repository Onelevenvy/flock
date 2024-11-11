from langchain_openai import ChatOpenAI
from crewai import LLM
from app.models import ModelCapability, ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "Qwen",
    "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "api_key": "fakeapikey",
    "icon": "qwen_icon",
    "description": "qwen API provider",
}

SUPPORTED_MODELS = [
    {
        "name": "qwen2-57b-a14b-instruct",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "qwen2-72b-instruct",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "qwen-vl-plus",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
    {
        "name": "text-embedding-v1",
        "categories": [ModelCategory.TEXT_EMBEDDING],
        "capabilities": [],
    },
    {
        "name": "text-embedding-v2",
        "categories": [ModelCategory.TEXT_EMBEDDING],
        "capabilities": [],
    },
    {
        "name": "text-embedding-v3",
        "categories": [ModelCategory.TEXT_EMBEDDING],
        "capabilities": [],
    },
]


def init_model(
    model: str, temperature: float, openai_api_key: str, openai_api_base: str, **kwargs
):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            openai_api_key=openai_api_key,
            openai_api_base=openai_api_base,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")


def init_crewai_model(model: str, openai_api_key: str, openai_api_base: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return LLM(
            model=f"openai/{model}",
            base_url=openai_api_base,
            api_key=openai_api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
