from langchain_openai import ChatOpenAI
from crewai import LLM

from app.models import ModelCapability, ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "zhipuai",
    "base_url": "https://open.bigmodel.cn/api/paas/v4",
    "api_key": "fake_api_key",
    "icon": "zhipuai_icon",
    "description": "智谱AI",
}

SUPPORTED_MODELS = [
    {
        "name": "glm-4-alltools",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "glm-4-flash",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "glm-4-0520",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "glm-4-plus",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "glm-4v-plus",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
    {
        "name": "glm-4",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "glm-4v",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
    {
        "name": "embedding-3",
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
            model=f"openai/{model}",  # CrewAI 格式：provider/model  zhipuai采用openai
            base_url=openai_api_base,
            api_key=openai_api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
