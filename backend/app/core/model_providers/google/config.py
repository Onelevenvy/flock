from langchain_google_genai import ChatGoogleGenerativeAI

from crewai import LLM

from app.models import ModelCapability, ModelCategory

PROVIDER_CONFIG = {
    "provider_name": "google",
    "base_url": "https://generativelanguage.googleapis.com/v1beta",
    "api_key": "",
    "icon": "gemini_icon",
    "description": "Google提供的Gemini模型",
}

SUPPORTED_MODELS = [
    {
        "name": "gemini-2.0-flash-exp",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
    {
        "name": "gemini-2.0-flash-thinking-exp-1219",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
]


def init_model(
    model: str, temperature: float, openai_api_key: str, openai_api_base: str, **kwargs
):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            google_api_key=openai_api_key,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")


def init_crewai_model(model: str, openai_api_key: str, openai_api_base: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return LLM(
            model=f"gemini/{model}",  # CrewAI 格式：provider/model  zhipuai采用openai
            base_url=openai_api_base,
            api_key=openai_api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
