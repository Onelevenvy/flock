from typing import Optional, List, Dict, Any

from sqlmodel import Session, select

from ..models import (
    ModelOutIdWithAndName,
    ModelProvider,
    ModelProviderCreate,
    ModelProviderUpdate,
    ModelProviderWithModelsListOut,
    ProvidersListWithModelsOut,
    Models,
)


def create_model_provider(
    session: Session, model_provider: ModelProviderCreate
) -> ModelProvider:
    # 创建新的 ModelProvider 实例
    db_model_provider = ModelProvider(
        provider_name=model_provider.provider_name,
        base_url=model_provider.base_url,
        icon=model_provider.icon,
        description=model_provider.description,
    )
    
    # 使用 set_api_key 方法设置并加密 api_key
    db_model_provider.set_api_key(model_provider.api_key)
    
    session.add(db_model_provider)
    session.commit()
    session.refresh(db_model_provider)
    return db_model_provider


def get_model_provider(
    session: Session, model_provider_id: int
) -> Optional[ModelProvider]:
    return session.exec(
        select(ModelProvider).where(ModelProvider.id == model_provider_id)
    ).first()


def update_model_provider(
    session: Session, model_provider_id: int, model_provider_update: ModelProviderUpdate
) -> Optional[ModelProvider]:
    db_model_provider = get_model_provider(session, model_provider_id)
    if db_model_provider:
        update_data = model_provider_update.model_dump(exclude_unset=True)
        
        # 特殊处理 api_key，使用 set_api_key 方法进行加密
        if "api_key" in update_data:
            api_key = update_data.pop("api_key")  # 从更新数据中移除
            db_model_provider.set_api_key(api_key)  # 使用方法加密并设置
            
        # 更新其他字段
        for key, value in update_data.items():
            setattr(db_model_provider, key, value)
            
        session.add(db_model_provider)
        session.commit()
        session.refresh(db_model_provider)
    return db_model_provider


def delete_model_provider(
    session: Session, model_provider_id: int
) -> Optional[ModelProvider]:
    try:
        # 先查询要删除的 ModelProvider
        model_provider = session.get(ModelProvider, model_provider_id)

        if model_provider is None:
            # 如果没有找到该 ModelProvider，返回 None
            return None

        # 删除关联的 Models
        # 通过删除 ModelProvider 会触发级联删除 (假设模型间关系已设置正确)
        # 这里直接删除 ModelProvider，若级联删除没有配置，需手动删除关联 Models
        session.delete(model_provider)

        # 提交事务
        session.commit()

        return model_provider

    except ModuleNotFoundError:
        # 如果发生查询异常，返回 None
        session.rollback()
        return None
    except Exception as e:
        # 捕获其他异常，回滚事务
        session.rollback()
        print(f"An error occurred: {e}")
        return None


def get_model_provider_with_models(
    session: Session, provider_id: int
) -> ModelProviderWithModelsListOut:
    statement = select(ModelProvider).where(ModelProvider.id == provider_id)
    result = session.exec(statement).first()
    if result:
        models_out = [
            ModelOutIdWithAndName(
                id=model.id,
                ai_model_name=model.ai_model_name,
                categories=model.categories,
                capabilities=model.capabilities,
            )
            for model in result.models
        ]
        if models_out:
            return ModelProviderWithModelsListOut(
                id=result.id,
                provider_name=result.provider_name,
                base_url=result.base_url,
                api_key=result.api_key,
                icon=result.icon,
                description=result.description,
                models=models_out,
            )
        else:
            return ModelProviderWithModelsListOut(
                id=result.id,
                provider_name=result.provider_name,
                base_url=result.base_url,
                api_key=result.api_key,
                icon=result.icon,
                description=result.description,
                models=[],
            )
    else:
        return None


def get_model_provider_list_with_models(
    session: Session,
) -> ProvidersListWithModelsOut:
    statement = select(ModelProvider)
    results = session.exec(statement).all()

    providers_list = []
    for result in results:
        models_out = [
            ModelOutIdWithAndName(
                id=model.id,
                ai_model_name=model.ai_model_name,
                categories=model.categories,
                capabilities=model.capabilities,
            )
            for model in result.models
        ]
        providers_list.append(
            ModelProviderWithModelsListOut(
                id=result.id,
                provider_name=result.provider_name,
                base_url=result.base_url,
                api_key=result.api_key,
                icon=result.icon,
                description=result.description,
                models=models_out,
            )
        )

    return ProvidersListWithModelsOut(providers=providers_list)


def sync_provider_models(
    session: Session, 
    provider_id: int, 
    config_models: List[Dict[str, Any]]
) -> List[Models]:
    """
    同步配置文件中的模型到数据库
    """
    # 获取现有模型
    existing_models = session.exec(
        select(Models).where(Models.provider_id == provider_id)
    ).all()
    existing_model_names = {model.ai_model_name for model in existing_models}
    
    synced_models = []
    
    for config_model in config_models:
        model_name = config_model["name"]
        
        # 准备模型元数据
        meta_ = {}
        if "dimension" in config_model:
            meta_["dimension"] = config_model["dimension"]
            
        if model_name in existing_model_names:
            # 更新现有模型
            model = next(m for m in existing_models if m.ai_model_name == model_name)
            model.categories = config_model["categories"]
            model.capabilities = config_model.get("capabilities", [])
            model.meta_ = meta_
        else:
            # 创建新模型
            model = Models(
                ai_model_name=model_name,
                provider_id=provider_id,
                categories=config_model["categories"],
                capabilities=config_model.get("capabilities", []),
                meta_=meta_
            )
            session.add(model)
            
        synced_models.append(model)
    
    session.commit()
    return synced_models
