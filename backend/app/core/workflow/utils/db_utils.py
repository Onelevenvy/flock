from collections.abc import Callable
from contextlib import contextmanager
from typing import TypeVar

from sqlmodel import Session, select

from app.core.database import get_session
from app.models import ModelProvider, Models

T = TypeVar("T")


@contextmanager
def get_db_session():
    session = next(get_session())
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def db_operation(operation: Callable[[Session], T]) -> T:
    with get_db_session() as session:
        return operation(session)


# 示例用法
def get_all_models_helper():
    from app.curd.models import get_all_models

    return db_operation(get_all_models)


def get_models_by_provider_helper(provider_id: int):
    from app.curd.models import get_models_by_provider

    return db_operation(lambda session: get_models_by_provider(session, provider_id))


# 可以根据需要添加更多辅助函数
def get_model_info(model_name: str) -> dict[str, str]:
    """
    Get model information from all available models.
    """
    with get_db_session() as session:
        # 直接从数据库查询 Models 和关联的 ModelProvider
        model = session.exec(
            select(Models).join(ModelProvider).where(Models.ai_model_name == model_name)
        ).first()

        if not model:
            raise ValueError(f"Model {model_name} not supported now.")

        return {
            "ai_model_name": model.ai_model_name,
            "provider_name": model.provider.provider_name,
            "base_url": model.provider.base_url,
            "api_key": model.provider.decrypted_api_key,  # 现在可以使用decrypted_api_key
        }
