import importlib
import os
from collections.abc import Callable
from typing import Any


class ModelProviderManager:
    def __init__(self):
        self.providers: dict[str, dict[str, Any]] = {}
        self.models: dict[str, list[str]] = {}
        self.init_functions: dict[str, Callable] = {}
        self.provider_modules: dict[str, Any] = {}  # 存储提供商模块
        self.credentials_model_names: dict[str, str] = {}  # 存储鉴权模型名
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
                    credentials_model_name = getattr(
                        module, "CREDENTIALS_MODEL_NAME", None
                    )

                    if provider_config and init_function:
                        self.providers[item] = provider_config
                        self.models[item] = supported_models
                        self.init_functions[item] = init_function
                        if credentials_model_name:
                            self.credentials_model_names[item] = credentials_model_name

                except ImportError as e:
                    print(f"Failed to load provider config for {item}: {e}")

    def get_provider_config(self, provider_name: str) -> dict[str, Any]:
        return self.providers.get(provider_name, {})

    def get_supported_models(self, provider_name: str) -> list[str]:
        return self.models.get(provider_name, [])

    def get_all_providers(self) -> dict[str, dict[str, Any]]:
        return self.providers

    def get_all_models(self) -> dict[str, list[str]]:
        return self.models

    def get_credentials_model_name(self, provider_name: str) -> str | None:
        """
        获取指定提供商的鉴权模型名
        Args:
            provider_name: 提供商名称
        Returns:
            鉴权模型名字符串，如果不存在则返回None
        """
        return self.credentials_model_names.get(provider_name)

    def init_model(
        self,
        provider_name: str,
        model: str,
        temperature: float,
        api_key: str,
        base_url: str,
        **kwargs,
    ):
        init_function = self.init_functions.get(provider_name)
        if init_function:

            return init_function(model, temperature, api_key, base_url, **kwargs)
        else:
            raise ValueError(
                f"No initialization function found for provider: {provider_name}"
            )


model_provider_manager = ModelProviderManager()
