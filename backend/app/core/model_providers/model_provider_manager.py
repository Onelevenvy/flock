import importlib
import os
from typing import Any, Callable, Dict, List


class ModelProviderManager:
    def __init__(self):
        self.providers: Dict[str, Dict[str, Any]] = {}
        self.models: Dict[str, List[str]] = {}
        self.init_functions: Dict[str, Callable] = {}
        self.init_crewai_functions: Dict[str, Callable] = {}
        self.load_providers()

    def load_providers(self):
        providers_dir = os.path.dirname(os.path.abspath(__file__))
        for item in os.listdir(providers_dir):
            if os.path.isdir(os.path.join(providers_dir, item)) and not item.startswith(
                "__"
            ):
                try:
                    module = importlib.import_module(
                        f".{item}.config", package="app.core.model_providers"
                    )
                    provider_config = getattr(module, "PROVIDER_CONFIG", None)
                    supported_models = getattr(module, "SUPPORTED_MODELS", [])
                    init_function = getattr(module, "init_model", None)
                    init_crewai_function = getattr(module, "init_crewai_model", None)

                    if provider_config and init_function:
                        self.providers[item] = provider_config
                        self.models[item] = supported_models
                        self.init_functions[item] = init_function
                        if init_crewai_function:
                            self.init_crewai_functions[item] = init_crewai_function
                except ImportError as e:
                    print(f"Failed to load provider config for {item}: {e}")

    def get_provider_config(self, provider_name: str) -> Dict[str, Any]:
        return self.providers.get(provider_name, {})

    def get_supported_models(self, provider_name: str) -> List[str]:
        return self.models.get(provider_name, [])

    def get_all_providers(self) -> Dict[str, Dict[str, Any]]:
        return self.providers

    def get_all_models(self) -> Dict[str, List[str]]:
        return self.models

    def init_model(
        self,
        provider_name: str,
        model: str,
        temperature: float,
        openai_api_key: str,
        openai_api_base: str,
        **kwargs,
    ):
        init_function = self.init_functions.get(provider_name)
        if init_function:
            return init_function(
                model, temperature, openai_api_key, openai_api_base, **kwargs
            )
        else:
            raise ValueError(
                f"No initialization function found for provider: {provider_name}"
            )

    def init_crewai_model(
        self,
        provider_name: str,
        model: str,
        openai_api_key: str,
        openai_api_base: str,
        **kwargs,
    ):
        init_function = self.init_crewai_functions.get(provider_name)
        if init_function:
            return init_function(model, openai_api_key, openai_api_base, **kwargs)
        else:
            raise ValueError(
                f"No crewai initialization function found for provider: {provider_name}"
            )


model_provider_manager = ModelProviderManager()
