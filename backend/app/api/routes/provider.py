from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.api.deps import SessionDep
from app.curd.modelprovider import (
    create_model_provider,
    delete_model_provider,
    get_model_provider,
    get_model_provider_list_with_models,
    get_model_provider_with_models,
    update_model_provider,
    sync_provider_models,
)
from app.models import (
    ModelProvider,
    ModelProviderCreate,
    ModelProviderUpdate,
    ModelProviderWithModelsListOut,
    ProvidersListWithModelsOut,
)
from app.core.model_providers.model_provider_manager import model_provider_manager
from sqlmodel import select

router = APIRouter()


# Routes for ModelProvider
@router.post("/", response_model=ModelProvider)
def create_provider(model_provider: ModelProviderCreate, session: SessionDep):
    return create_model_provider(session, model_provider)


@router.get("/{model_provider_id}", response_model=ModelProvider)
def read_provider(model_provider_id: int, session: SessionDep):
    model_provider = get_model_provider(session, model_provider_id)
    if model_provider is None:
        raise HTTPException(status_code=404, detail="ModelProvider not found")
    return model_provider


@router.get(
    "/withmodels/{model_provider_id}", response_model=ModelProviderWithModelsListOut
)
def read_provider_with_models(model_provider_id: int, session: SessionDep):
    model_provider_with_models = get_model_provider_with_models(
        session, model_provider_id
    )
    if model_provider_with_models is None:
        raise HTTPException(status_code=404, detail="ModelProvider not found")
    return model_provider_with_models


@router.get("/", response_model=ProvidersListWithModelsOut)
def read_provider_list_with_models(session: SessionDep):
    model_provider_with_models = get_model_provider_list_with_models(session)
    if model_provider_with_models is None:
        raise HTTPException(status_code=404, detail="ModelProvider not found")
    return model_provider_with_models


@router.put("/{model_provider_id}", response_model=ModelProvider)
def update_provider(
    model_provider_id: int,
    model_provider_update: ModelProviderUpdate,
    session: SessionDep,
):
    model_provider = update_model_provider(
        session, model_provider_id, model_provider_update
    )
    if model_provider is None:
        raise HTTPException(status_code=404, detail="ModelProvider not found")
    return model_provider


@router.delete("/{model_provider_id}", response_model=ModelProvider)
def delete_provider(model_provider_id: int, session: SessionDep):
    model_provider = delete_model_provider(session, model_provider_id)
    if model_provider is None:
        raise HTTPException(status_code=404, detail="ModelProvider not found")
    return model_provider


# 新增：同步提供者的模型配置到数据库
@router.post("/{provider_name}/sync", response_model=List[str])
async def sync_provider(
    provider_name: str,
    session: SessionDep,
):
    """
    从配置文件同步提供者的模型到数据库
    返回同步的模型名称列表
    """
    provider = session.exec(
        select(ModelProvider).where(ModelProvider.provider_name == provider_name)
    ).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # 获取提供者的配置模型
    config_models = model_provider_manager.get_supported_models(provider_name)
    if not config_models:
        raise HTTPException(
            status_code=404, 
            detail=f"No models found in configuration for provider {provider_name}"
        )
    
    # 同步模型到数据库
    synced_models = sync_provider_models(session, provider.id, config_models)
    
    return [model.ai_model_name for model in synced_models]
