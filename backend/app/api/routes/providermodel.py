from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import SessionDep
from app.curd.models import (
    _create_model,
    _delete_model,
    _update_model,
    get_all_models,
    get_models_by_provider,
)
from app.models import Models, ModelsBase, ModelsOut

router = APIRouter()


# 新增一个用于创建模型的请求模型
class ModelCreate(ModelsBase):
    meta_: dict[str, Any] | None = None


# 新增一个用于更新模型的请求模型
class ModelUpdate(ModelsBase):
    ai_model_name: str | None = None
    provider_id: int | None = None
    categories: list | None = None
    capabilities: list | None = None
    meta_: dict[str, Any] | None = None


@router.post("/", response_model=Models)
def create_models(model: ModelCreate, session: SessionDep):
    # 确保dimension在meta_中
    if model.meta_ is None:
        model.meta_ = {}
    return _create_model(session, model)


@router.get("/{provider_id}", response_model=ModelsOut)
def read_model(provider_id: int, session: SessionDep):
    return get_models_by_provider(session, provider_id)


@router.get("/", response_model=ModelsOut)
def read_models(session: SessionDep):
    return get_all_models(session)


@router.delete("/{model_id}", response_model=Models)
def delete_model(model_id: int, session: SessionDep):
    model = _delete_model(session, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.put("/{model_id}", response_model=Models)
def update_model(model_id: int, model_update: ModelUpdate, session: SessionDep):
    model = _update_model(session, model_id, model_update)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


# 新增一个用于更新模型元数据的端点
@router.patch("/{model_id}/metadata", response_model=Models)
async def update_model_metadata(
    model_id: int, metadata_update: dict[str, Any], session: SessionDep
):
    model = session.get(Models, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")

    # 更新元数据
    model.meta_.update(metadata_update)
    session.add(model)
    session.commit()
    session.refresh(model)
    return model
