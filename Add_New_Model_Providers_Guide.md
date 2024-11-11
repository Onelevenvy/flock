# 🤖 Models Guide

## Supported Models

Flock currently supports various model providers and their models:

### OpenAI
- GPT-4 Series
  - gpt-4
  - gpt-4-0314
  - gpt-4-32k
  - gpt-4-32k-0314
- GPT-3.5 Series
  - gpt-3.5-turbo
  - gpt-3.5-turbo-16k
- Others
  - gpt-4o-mini

### ZhipuAI
- GLM-4 Series
  - glm-4-alltools
  - glm-4-flash
  - glm-4-0520
  - glm-4-plus
  - glm-4
- Vision Models
  - glm-4v-plus
  - glm-4v
- Embedding Models
  - embedding-3

### Qwen
- Chat Models
  - qwen2-57b-a14b-instruct
  - qwen2-72b-instruct
- Vision Models
  - qwen-vl-plus
- Embedding Models
  - text-embedding-v1/v2/v3

### Siliconflow
- Qwen Series
  - Qwen/Qwen2-7B-Instruct

### Ollama
- Llama Series
  - llama3.1:8b

## How to Add New Model Support

You can easily add support for new model providers by following these steps:

### 1. Create Provider Directory

Create a new directory under `backend/app/core/model_providers/` with your provider name:

```bash
mkdir backend/app/core/model_providers/your_provider_name
```

### 2. Create Configuration File

Inside your provider directory, create a `config.py` file:

```python
from langchain_openai import ChatOpenAI  # or other appropriate base class
from crewai import LLM
from app.models import ModelCategory, ModelCapability

# Basic provider configuration
PROVIDER_CONFIG = {
    "provider_name": "Your Provider Name",
    "base_url": "https://api.your-provider.com/v1",
    "api_key": "fake_api_key",  # Default placeholder
    "icon": "provider_icon",
    "description": "Your Provider Description",
}

# Define supported models
SUPPORTED_MODELS = [
    {
        "name": "model-name-1",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "model-name-2",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],  # For models with vision capabilities
    },
    {
        "name": "embedding-model",
        "categories": [ModelCategory.TEXT_EMBEDDING],
        "capabilities": [],
    },
]

def init_model(model: str, temperature: float, openai_api_key: str, openai_api_base: str, **kwargs):
    """Initialize a model for standard use"""
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
    """Initialize a model for CrewAI use"""
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if model_info and ModelCategory.CHAT in model_info["categories"]:
        return LLM(
            model=f"provider_name/{model}",  # Format: provider/model
            base_url=openai_api_base,
            api_key=openai_api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model.")
```

### 3. Model Categories and Capabilities

Available model categories:
```python
class ModelCategory(str, Enum):
    LLM = "llm"
    CHAT = "chat"
    TEXT_EMBEDDING = "text-embedding"
    RERANK = "rerank"
    SPEECH_TO_TEXT = "speech-to-text"
    TEXT_TO_SPEECH = "text-to-speech"
```

Available capabilities:
```python
class ModelCapability(str, Enum):
    VISION = "vision"
```

### 4. Auto-Registration

The `ModelProviderManager` will automatically discover and register your new provider when Flock starts up. It:
- Scans the model_providers directory
- Loads provider configurations
- Registers initialization functions
- Makes models available in the system

### Best Practices

1. **Configuration**: Keep provider-specific configuration in the config.py file
2. **Model Support**: Clearly define which models are supported and their capabilities
3. **Error Handling**: Include proper error handling in initialization functions
4. **Documentation**: Provide clear descriptions for your provider and models
5. **Testing**: Test both standard and CrewAI initialization paths

### Example Implementation

Here's a complete example for a new provider:

```python
from langchain_openai import ChatOpenAI
from crewai import LLM
from app.models import ModelCategory, ModelCapability

PROVIDER_CONFIG = {
    "provider_name": "NewAI",
    "base_url": "https://api.newai.com/v1",
    "api_key": "fake_api_key",
    "icon": "newai_icon",
    "description": "NewAI - Next Generation Language Models",
}

SUPPORTED_MODELS = [
    {
        "name": "newai-chat-large",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [],
    },
    {
        "name": "newai-vision",
        "categories": [ModelCategory.LLM, ModelCategory.CHAT],
        "capabilities": [ModelCapability.VISION],
    },
]

def init_model(model: str, temperature: float, openai_api_key: str, openai_api_base: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if not model_info:
        raise ValueError(f"Model {model} is not supported")
        
    if ModelCategory.CHAT in model_info["categories"]:
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            openai_api_key=openai_api_key,
            openai_api_base=openai_api_base,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model")

def init_crewai_model(model: str, openai_api_key: str, openai_api_base: str, **kwargs):
    model_info = next((m for m in SUPPORTED_MODELS if m["name"] == model), None)
    if not model_info:
        raise ValueError(f"Model {model} is not supported")
        
    if ModelCategory.CHAT in model_info["categories"]:
        return LLM(
            model=f"newai/{model}",
            base_url=openai_api_base,
            api_key=openai_api_key,
            **kwargs,
        )
    else:
        raise ValueError(f"Model {model} is not supported as a chat model")
``` 