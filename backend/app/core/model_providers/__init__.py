import importlib


def get_provider_config(provider_name: str):
    try:
        module = importlib.import_module(
            f"app.core.model_providers.{provider_name}.config"
        )
        return module.PROVIDER_CONFIG
    except ImportError:
        raise ValueError(f"No configuration found for provider: {provider_name}")
