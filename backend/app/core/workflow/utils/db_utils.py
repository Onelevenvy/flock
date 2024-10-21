from contextlib import contextmanager
from typing import Callable, TypeVar

from sqlmodel import Session

from app.core.database import get_session

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
