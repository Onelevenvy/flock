from crewai import LLM
from langchain_ollama import ChatOllama

from app.models import ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "ollama",
    "base_url": "http://host.docker.internal:11434",
    "api_key": "",
    "icon": "ollama_icon",
    "description": "本地部署的Ollama模型",
}

SUPPORTED_MODELS = [
    {
        "name": "llama3.1:8b",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
]


def init_model(model: str, temperature: float, api_key: str, base_url: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return ChatOllama(
            model=model, temperature=temperature, base_url=base_url, **kwargs
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")


def init_crewai_model(model: str, api_key: str, base_url: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return LLM(
            model=f"ollama/{model}",
            base_url=base_url,
            api_key=api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
