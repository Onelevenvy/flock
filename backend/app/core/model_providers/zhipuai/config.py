from langchain_openai import ChatOpenAI
from crewai import LLM

from app.models import ModelCapability, ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "zhipuai",
    "base_url": "https://open.bigmodel.cn/api/paas/v4",
    "api_key": "",
    "icon": "zhipuai_icon",
    "description": "智谱AI提供的模型",
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
        "name": "glm-4v-flash",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
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
        "dimension": 2048,
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


def init_crewai_model(model: str, api_key: str, base_url: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return LLM(
            model=f"openai/{model}",  # CrewAI 格式：provider/model  zhipuai采用openai
            base_url=base_url,
            api_key=api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
