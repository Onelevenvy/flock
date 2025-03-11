from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from sqlmodel import col, func, or_, select
from loguru import logger

from app.api.deps import CurrentUser, SessionDep
from app.core.tools.api_tool import ToolDefinition
from app.core.tools.tool_invoker import ToolInvokeResponse, invoke_tool
from app.models import (
    Message,
    Skill,
    SkillCreate,
    SkillOut,
    SkillsOut,
    SkillUpdate,
    ToolDefinitionValidate,
)
from langchain_mcp_adapters.client import MultiServerMCPClient

router = APIRouter()


def validate_tool_definition(tool_definition: dict[str, Any]) -> ToolDefinition | None:
    """
    Validates the tool_definition.
    Raises an HTTPException with detailed validation errors if invalid.
    """
    try:
        return ToolDefinition.model_validate(tool_definition)
    except ValidationError as e:
        error_details = []
        for error in e.errors():
            loc = " -> ".join(map(str, error["loc"]))
            msg = error["msg"]
            error_details.append(f"Field '{loc}': {msg}")
        raise HTTPException(status_code=400, detail="; ".join(error_details))


@router.get("/", response_model=SkillsOut)
def read_skills(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve skills
    """
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Skill)
        count = session.exec(count_statement).one()
        statement = (
            select(Skill).order_by(col(Skill.id).desc()).offset(skip).limit(limit)
        )

    else:
        count_statement = (
            select(func.count())
            .select_from(Skill)
            .where(
                or_(Skill.managed == True, Skill.owner_id == current_user.id)
            )  # noqa: E712
        )
        count = session.exec(count_statement).one()

        statement = (
            select(Skill)
            .where(
                or_(Skill.managed == True, Skill.owner_id == current_user.id)
            )  # noqa: E712
            .order_by(col(Skill.id).desc())
            .offset(skip)
            .limit(limit)
        )

    skills = session.exec(statement).all()

    return SkillsOut(data=skills, count=count)


@router.get("/{id}", response_model=SkillOut)
def read_skill(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get skill by ID.
    """
    skill = session.get(Skill, id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if not skill.managed and (skill.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return skill


@router.post("/", response_model=SkillOut)
def create_skill(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    skill_in: SkillCreate,
) -> Any:
    """
    Create new skill.
    """
    validate_tool_definition(skill_in.tool_definition)

    skill = Skill.model_validate(skill_in, update={"owner_id": current_user.id})
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return skill


@router.put("/{id}", response_model=SkillOut)
def update_skill(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    skill_in: SkillUpdate,
) -> Any:
    """
    Update a skill.
    """
    skill = session.get(Skill, id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if not current_user.is_superuser and (skill.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")

    if skill_in.tool_definition:
        validate_tool_definition(skill_in.tool_definition)

    update_dict = skill_in.model_dump(exclude_unset=True)

    # 处理 credentials 字段
    if "credentials" in update_dict:
        if skill.credentials is None:
            skill.credentials = {}
        skill.credentials.update(update_dict["credentials"])
        del update_dict["credentials"]  # 从 update_dict 中移除,因为我们已经单独处理了

    skill.sqlmodel_update(update_dict)
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return skill


@router.delete("/{id}")
def delete_skill(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Delete a skill.
    """
    skill = session.get(Skill, id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if not current_user.is_superuser and (skill.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if skill.managed:
        raise HTTPException(status_code=400, detail="Cannot delete managed skills")
    session.delete(skill)
    session.commit()
    return Message(message="Skill deleted successfully")


@router.post("/validate")
def validate_skill(tool_definition_in: ToolDefinitionValidate) -> Any:
    """
    Validate skill's tool definition.
    """
    try:
        validated_tool_definition = validate_tool_definition(
            tool_definition_in.tool_definition
        )
        return validated_tool_definition
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoke-tool")
def invoke_tools(tool_name: str, args: dict) -> ToolInvokeResponse:
    """
    Invoke a tool by name with the provided arguments.
    """
    result = invoke_tool(tool_name, args)  # 调用工具函数
    return result  # 直接返回自定义响应模型


@router.post("/update-credentials/{id}", response_model=SkillOut)
def update_skill_credentials(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    credentials: dict[str, dict[str, Any]],
) -> Any:
    """
    Update a skill's credentials.
    """

    skill = session.get(Skill, id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    if not current_user.is_superuser and (skill.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")

    if skill.credentials is None:
        skill.credentials = {}

    # 直接更新整个凭证字典
    skill.credentials = credentials

    session.add(skill)
    session.commit()
    session.refresh(skill)

    return skill

@router.post("/mcp/tools")
async def get_mcp_tools(mcp_config: dict[str, Any]) -> Any:
    """
    获取MCP服务器的工具列表
    """
    try:
        # 添加日志打印
        logger.info(f"Received mcp_config: {mcp_config}")
        
        async with MultiServerMCPClient(mcp_config) as client:
            tools = client.get_tools()
            # 只返回工具的基本信息
            tools_info = [{
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.args
            } for tool in tools]
            return {"tools": tools_info}
    except Exception as e:
        # 添加错误日志
        logger.error(f"Error in get_mcp_tools: {str(e)}")
        logger.exception(e)
        raise HTTPException(status_code=400, detail=str(e))