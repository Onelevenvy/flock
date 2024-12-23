from langchain_openai import ChatOpenAI
from crewai import LLM

from app.models import ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "openai",
    "base_url": "https://api.openai.com/v1",
    "api_key": "",
    "icon": "openai_icon",
    "description": "OpenAI API provider",
}

SUPPORTED_MODELS = [
    {
        "name": "gpt-4",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "gpt-4-0314",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "gpt-4-32k",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "gpt-4-32k-0314",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "gpt-3.5-turbo",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "gpt-3.5-turbo-16k",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "gpt-4o-mini",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
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
            model=f"openai/{model}",  # CrewAI 格式：provider/model
            base_url=openai_api_base,
            api_key=openai_api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
