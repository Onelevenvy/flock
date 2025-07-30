import json
import logging
from typing import Tuple

from sqlmodel import Session, select

from app.core.tools.tool_manager import (get_tool_by_name,
                                         get_tool_credentials_function)
from app.db.models import Tool, ToolProvider

logger = logging.getLogger(__name__)


async def authenticate_tool_provider(
    session: Session, provider_id: int
) -> Tuple[bool, str]:
    """
    对工具提供商进行鉴权，测试凭据是否有效
    如果鉴权成功，将提供商标记为可用，并将其所有工具设置为在线
    如果鉴权失败，将提供商标记为不可用，并将其所有工具设置为离线

    Args:
        session: 数据库会话
        provider_id: 提供商ID

    Returns:
        Tuple[bool, str]: (是否鉴权成功, 错误信息或成功消息)
    """
    # 获取提供商信息
    provider = session.get(ToolProvider, provider_id)
    if not provider:
        return False, "工具提供商不存在"

    # 获取提供商的所有工具
    tools = session.exec(select(Tool).where(Tool.provider_id == provider_id)).all()

    # 检查凭据是否存在
    if not provider.credentials or provider.credentials == {}:
        # 如果没有凭据，则认为不需要鉴权，直接设置为可用
        provider.is_available = True
        session.add(provider)

        # 将所有工具设置为在线
        for tool in tools:
            tool.is_online = True
            session.add(tool)

        session.commit()
        return True, "无需鉴权，工具提供商已设置为可用"

    if not tools:
        # 没有工具，但是有凭据，设置提供商为可用
        provider.is_available = True
        session.add(provider)
        session.commit()
        return True, "工具提供商没有关联的工具，但凭据已保存"

    # 从credentials_function获取测试参数
    test_config = get_tool_credentials_function(provider.provider_name)
    test_tool_name = test_config.get("tool_name", "")
    test_params = test_config.get("input_parameters", {})

    # 如果credentials_function提供了工具名称和参数
    if test_tool_name and test_params:
        # 查找指定的工具
        test_tool = None
        for tool in tools:
            if tool.name == test_tool_name:
                test_tool = tool
                break

        if test_tool:
            try:
                # 使用credentials_function提供的参数调用工具
                logger.info(
                    f"使用credentials_function测试工具: {test_tool_name}, 参数: {test_params}"
                )
                # 使用provider_name:tool_name格式
                tool_full_name = f"{provider.provider_name}:{test_tool_name}"
                tool = get_tool_by_name(tool_full_name)
                # result = get_tool_by_name(tool_full_name).invoke(test_params)
                result = tool.invoke(test_params)

                # 检查结果是否为JSON格式，并包含success字段
                try:
                    parsed_result = json.loads(result)
                    if isinstance(parsed_result, dict) and "success" in parsed_result:
                        if not parsed_result["success"]:
                            error_msg = parsed_result.get("error", "未知错误")
                            logger.error(f"鉴权失败，错误信息: {error_msg}")

                            # 鉴权失败，将提供商标记为不可用
                            provider.is_available = False
                            session.add(provider)

                            # 将所有工具设置为离线
                            for tool in tools:
                                tool.is_online = False
                                session.add(tool)

                            session.commit()
                            return False, f"鉴权失败，错误信息: {error_msg}"
                    elif isinstance(parsed_result, dict) and "error" in parsed_result:
                        error_msg = parsed_result.get("error", "未知错误")
                        logger.error(f"鉴权失败，错误信息: {error_msg}")

                        # 鉴权失败，将提供商标记为不可用
                        provider.is_available = False
                        session.add(provider)

                        # 将所有工具设置为离线
                        for tool in tools:
                            tool.is_online = False
                            session.add(tool)

                        session.commit()
                        return False, f"鉴权失败，错误信息: {error_msg}"
                except (json.JSONDecodeError, TypeError):
                    # 如果不是JSON格式，检查是否包含错误信息
                    if isinstance(result, str) and (
                        "Error:" in result or "error" in result.lower()
                    ):
                        logger.error(f"鉴权失败，错误信息: {result}")

                        # 鉴权失败，将提供商标记为不可用
                        provider.is_available = False
                        session.add(provider)

                        # 将所有工具设置为离线
                        for tool in tools:
                            tool.is_online = False
                            session.add(tool)

                        session.commit()
                        return False, f"鉴权失败，错误信息: {result}"

                # 如果没有抛出异常，说明鉴权成功
                logger.info(f"工具调用成功: {result}")

                # 更新提供商和工具状态
                provider.is_available = True
                session.add(provider)

                # 将所有工具设置为在线
                for tool in tools:
                    tool.is_online = True
                    session.add(tool)

                session.commit()
                return True, "鉴权成功，工具提供商已可用，所有工具已上线"

            except Exception as e:
                logger.error(f"鉴权失败，报错信息: {str(e)}")

                # 鉴权失败，将提供商标记为不可用
                provider.is_available = False
                session.add(provider)

                # 将所有工具设置为离线
                for tool in tools:
                    tool.is_online = False
                    session.add(tool)

                session.commit()
                return False, f"鉴权失败，报错信息: {str(e)}"

        else:
            logger.warning(
                f"在提供商 {provider.provider_name} 中找不到工具 {test_tool_name}"
            )

            # 找不到测试工具，将提供商标记为不可用
            provider.is_available = False
            session.add(provider)

            # 将所有工具设置为离线
            for tool in tools:
                tool.is_online = False
                session.add(tool)

            session.commit()
            return (
                False,
                f"鉴权失败，报错信息: 在提供商 {provider.provider_name} 中找不到工具 {test_tool_name}",
            )

    # 如果没有测试参数，则认为不需要鉴权，直接设置为可用
    provider.is_available = True
    session.add(provider)

    # 将所有工具设置为在线
    for tool in tools:
        tool.is_online = True
        session.add(tool)

    session.commit()
    return True, "无需鉴权，工具提供商已设置为可用"


async def test_tool_availability(session: Session, tool_id: int) -> Tuple[bool, str]:
    """
    测试单个工具的可用性

    Args:
        session: 数据库会话
        tool_id: 工具ID

    Returns:
        Tuple[bool, str]: (工具是否可用, 错误信息或成功消息)
    """
    # 获取工具信息
    tool = session.get(Tool, tool_id)
    if not tool:
        return False, "工具不存在"

    # 获取关联的提供商
    provider = session.get(ToolProvider, tool.provider_id)
    if not provider:
        return False, "工具的提供商不存在"

    # 如果提供商不可用，工具也不可用
    if not provider.is_available:
        return False, "提供商不可用，无法测试工具"

    # 从credentials_function获取测试参数
    test_config = get_tool_credentials_function(provider.provider_name)
    test_tool_name = test_config.get("tool_name", "")
    test_params = test_config.get("input_parameters", {})

    # 如果credentials_function提供了工具名称和参数，并且与当前工具匹配
    if test_tool_name and test_params and tool.name == test_tool_name:
        try:
            # 使用credentials_function提供的参数调用工具
            logger.info(
                f"使用credentials_function测试工具: {test_tool_name}, 参数: {test_params}"
            )
            # 使用provider_name:tool_name格式
            tool_full_name = f"{provider.provider_name}:{test_tool_name}"
            result = get_tool_by_name(tool_full_name).invoke(test_params)

            # 检查结果是否为JSON格式，并包含success字段
            try:
                parsed_result = json.loads(result)
                if isinstance(parsed_result, dict) and "success" in parsed_result:
                    if not parsed_result["success"]:
                        error_msg = parsed_result.get("error", "未知错误")
                        logger.error(f"工具测试失败，错误信息: {error_msg}")
                        return False, f"工具测试失败，错误信息: {error_msg}"
                elif isinstance(parsed_result, dict) and "error" in parsed_result:
                    error_msg = parsed_result.get("error", "未知错误")
                    logger.error(f"工具测试失败，错误信息: {error_msg}")
                    return False, f"工具测试失败，错误信息: {error_msg}"
            except (json.JSONDecodeError, TypeError):
                # 如果不是JSON格式，检查是否包含错误信息
                if isinstance(result, str) and (
                    "Error:" in result or "error" in result.lower()
                ):
                    logger.error(f"工具测试失败，错误信息: {result}")
                    return False, f"工具测试失败，错误信息: {result}"

            # 如果没有抛出异常，说明工具可用
            logger.info(f"工具调用成功: {result}")

            # 更新工具状态
            tool.is_online = True
            session.add(tool)
            session.commit()

            return True, f"工具 {tool.name} 可用"

        except Exception as e:
            logger.error(f"鉴权失败，报错信息: {str(e)}")
            return False, f"鉴权失败，报错信息: {str(e)}"
