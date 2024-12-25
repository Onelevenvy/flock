
from sqlmodel import Session, func, select

from ..models import ModelOut, ModelProviderOut, Models, ModelsBase, ModelsOut


def _create_model(session: Session, model: ModelsBase) -> Models:
    try:
        db_model = Models(**model.model_dump())
        session.add(db_model)
        session.commit()
        session.refresh(db_model)
        return db_model
    except Exception as e:
        print(f"Error occurred: {e}")
        session.rollback()
        raise


def get_models_by_provider(session: Session, provider_id: int) -> ModelsOut:
    # 计数查询
    count_statement = (
        select(func.count())
        .select_from(Models)
        .where(Models.provider_id == provider_id)
    )
    total_count = session.exec(count_statement).one()

    # 模型查询
    statement = select(Models).where(Models.provider_id == provider_id)
    models = session.exec(statement).all()

    if not models:
        # 如果没有找到相关模型，可以返回空的 ModelsOut
        return ModelsOut(data=[], count=0)

    # 构建 ModelOut 列表
    model_outs = [
        ModelOut(
            id=model.id,
            ai_model_name=model.ai_model_name,
            categories=model.categories,
            capabilities=model.capabilities,
            provider=ModelProviderOut(
                id=model.provider.id,
                provider_name=model.provider.provider_name,
                base_url=model.provider.base_url,
                api_key=model.provider.encrypted_api_key,
                icon=model.provider.icon,
                description=model.provider.description,
            ),
        )
        for model in models
    ]

    # 返回 ModelsOut 对象
    return ModelsOut(data=model_outs, count=total_count)


def get_all_models(session: Session) -> ModelsOut:
    # 查询所有模型
    statement = select(Models)
    models_result = session.exec(statement)
    models = models_result.all()

    # 获取模型总数
    count_statement = select(func.count()).select_from(Models)
    count_result = session.exec(count_statement)
    total_count = count_result.one()

    if not models:
        # 如果没有找到模型，返回空的 ModelsOut
        return ModelsOut(data=[], count=0)

    # 构建 ModelOut 列表
    model_outs = [
        ModelOut(
            id=model.id,
            ai_model_name=model.ai_model_name,
            categories=model.categories,
            capabilities=model.capabilities,
            provider=ModelProviderOut(
                id=model.provider.id,
                provider_name=model.provider.provider_name,
                base_url=model.provider.base_url,
                api_key=model.provider.encrypted_api_key,
                icon=model.provider.icon,
                description=model.provider.description,
            ),
        )
        for model in models
    ]

    # 返回 ModelsOut 对象
    return ModelsOut(data=model_outs, count=total_count)


def _delete_model(session: Session, model_id: int) -> Models | None:
    db_model = session.exec(select(Models).where(Models.id == model_id)).first()
    if db_model:
        session.delete(db_model)
        session.commit()
    return db_model


def _update_model(
    session: Session, model_id: int, model_update: ModelsBase
) -> Models | None:
    db_model = session.exec(select(Models).where(Models.id == model_id)).first()
    if db_model:
        update_data = model_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_model, key, value)
        session.add(db_model)
        session.commit()
        session.refresh(db_model)
    return db_model
