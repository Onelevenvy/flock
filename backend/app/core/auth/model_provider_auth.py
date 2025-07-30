import logging
from typing import Tuple

from sqlmodel import Session, select

from app.core.model_providers.model_provider_manager import \
    model_provider_manager
from app.db.models import ModelProvider, Models

logger = logging.getLogger(__name__)


async def authenticate_provider(session: Session, provider_id: int) -> Tuple[bool, str]:
    """
    对模型提供商进行鉴权，测试API密钥是否有效
    如果鉴权成功，将提供商标记为可用，并将其所有模型设置为在线

    Args:
        session: 数据库会话
        provider_id: 提供商ID

    Returns:
        Tuple[bool, str]: (是否鉴权成功, 错误信息或成功消息)
    """
    # 获取提供商信息
    provider = session.get(ModelProvider, provider_id)
    if not provider:
        return False, "提供商不存在"

    # 检查API密钥是否存在
    api_key = provider.decrypted_api_key
    if not api_key:
        return False, "API密钥未设置"

    # 获取提供商的所有模型
    models = session.exec(select(Models).where(Models.provider_id == provider_id)).all()
    if not models:
        return False, "提供商没有关联的模型"

    # 尝试获取配置文件中指定的鉴权模型名称
    try:
        # 直接通过manager获取鉴权模型名
        credentials_model_name = model_provider_manager.get_credentials_model_name(
            provider.provider_name
        )
        if not credentials_model_name:
            logger.warning(
                f"提供商 {provider.provider_name} 未指定鉴权模型，将使用第一个模型"
            )
            test_model = models[0]
        else:
            # 查找匹配的模型
            test_model = next(
                (m for m in models if m.ai_model_name == credentials_model_name), None
            )
            if not test_model:
                logger.warning(
                    f"找不到指定的鉴权模型 {credentials_model_name}，将使用第一个模型"
                )
                test_model = models[0]
    except Exception as e:
        logger.error(f"获取鉴权模型时发生错误: {str(e)}")
        test_model = models[0]  # 出错时使用第一个模型

    # 尝试初始化并调用模型
    try:
        # 使用model_provider_manager初始化模型
        llm = model_provider_manager.init_model(
            provider_name=provider.provider_name,
            model=test_model.ai_model_name,
            temperature=0.01,
            api_key=api_key,
            base_url=provider.base_url,
            streaming=False,
            timeout=3.0,
            max_retries=0,
        )

        # 尝试调用模型
        response = llm.invoke("你好")

        # 如果没有抛出异常，说明鉴权成功
        logger.info(f"模型调用成功: {response}")

        # 更新提供商和模型状态
        provider.is_available = True
        session.add(provider)

        # 将所有模型设置为在线
        for model in models:
            model.is_online = True
            session.add(model)

        session.commit()
        return True, "鉴权成功，提供商已可用，所有模型已上线"

    except Exception as e:
        logger.error(f"模型调用失败: {str(e)}")

        # 更新提供商和模型状态
        provider.is_available = False
        session.add(provider)

        # 将所有模型设置为离线
        for model in models:
            model.is_online = False
            session.add(model)

        session.commit()
        return False, f"鉴权失败: {str(e)}"


async def test_model_availability(session: Session, model_id: int) -> Tuple[bool, str]:
    """
    测试单个模型的可用性

    Args:
        session: 数据库会话
        model_id: 模型ID

    Returns:
        Tuple[bool, str]: (模型是否可用, 错误信息或成功消息)
    """
    # 获取模型信息
    model = session.get(Models, model_id)
    if not model:
        return False, "模型不存在"

    # 获取关联的提供商
    provider = session.get(ModelProvider, model.provider_id)
    if not provider:
        return False, "模型的提供商不存在"

    # 如果提供商不可用，模型也不可用
    if not provider.is_available:
        return False, "提供商不可用，无法测试模型"

    # 尝试初始化并调用模型
    try:
        # 使用model_provider_manager初始化模型
        llm = model_provider_manager.init_model(
            provider_name=provider.provider_name,
            model=model.ai_model_name,
            temperature=0.01,
            api_key=provider.decrypted_api_key,
            base_url=provider.base_url,
            streaming=False,
        )

        # 尝试调用模型
        response = llm.invoke("你好")

        # 如果没有抛出异常，说明模型可用
        logger.info(f"模型调用成功: {response}")

        # 更新模型状态
        model.is_online = True
        session.add(model)
        session.commit()

        return True, f"模型 {model.ai_model_name} 可用"

    except Exception as e:
        logger.error(f"模型调用失败: {str(e)}")

        # 更新模型状态
        model.is_online = False
        session.add(model)
        session.commit()

        return False, f"测试失败: {str(e)}"
