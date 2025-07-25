from typing import Any

from fastapi import APIRouter, HTTPException
from langchain_mcp_adapters.client import MultiServerMCPClient
from loguru import logger
from pydantic import ValidationError
from sqlmodel import col, func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.core.tools.api_tool import ToolDefinition
from app.core.tools.tool_invoker import ToolInvokeResponse, invoke_tool
from app.models import (Message, Tool, ToolBase,ToolCreate,ToolsOut,Tool, ToolUpdate,ToolDefinitionValidate)

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


@router.post("/", response_model=ToolBase)
def create_tool(tool: ToolCreate):
    """
    Create new tool.
    """
    with session_getter() as session:
        # 验证工具定义
        if tool.tool_definition:
            validate_tool_definition(tool.tool_definition)
        return _create_tool(session, tool)


@router.get("/{provider_id}", response_model=ToolsOut)
def read_tool(provider_id: int):
    with session_getter() as session:
        return get_tools_by_provider(session, provider_id)


@router.get("/", response_model=ToolsOut)
def read_tools(skip: int = 0, limit: int = 100):
    with session_getter() as session:
        return get_all_tools(session, skip=skip, limit=limit)


@router.put("/{tool_id}", response_model=Tool)
def update_tool(tool_id: int, tool_update: ToolUpdate):
    """
    Update a tool.
    """
    with session_getter() as session:
        if tool_update.tool_definition:
            validate_tool_definition(tool_update.tool_definition)

        tool = _update_tool(session, tool_id, tool_update)
        if tool is None:
            raise HTTPException(status_code=404, detail="Tool not found")
        return tool


@router.delete("/{tool_id}", response_model=Tool)
def delete_tool(tool_id: int):
    """
    Delete a tool.
    """
    with session_getter() as session:
        tool = _delete_tool(session, tool_id)
        if tool is None:
            raise HTTPException(status_code=404, detail="Tool not found")
        if tool.managed:
            raise HTTPException(status_code=400, detail="Cannot delete managed tools")
        return tool


@router.post("/validate")
def validate_tool(tool_definition: dict[str, Any]) -> Any:
    """
    Validate tool's definition.
    """
    try:
        validated_tool_definition = validate_tool_definition(tool_definition)
        return validated_tool_definition
    except HTTPException as e:
        raise HTTPException(status_code=400, detail=str(e.detail))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoke")
def invoke_tools(tool_name: str, args: dict) -> ToolInvokeResponse:
    """
    Invoke a tool by name with the provided arguments.
    """
    try:
        result = invoke_tool(tool_name, args)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{tool_id}/input-parameters")
def update_tool_input_parameters(
    tool_id: int,
    input_parameters: dict[str, Any],
) -> Any:
    """
    Update a tool's input parameters.
    """
    with session_getter() as session:
        tool = session.get(Tool, tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")

        if tool.input_parameters is None:
            tool.input_parameters = {}

        tool.input_parameters.update(input_parameters)
        session.add(tool)
        session.commit()
        session.refresh(tool)
        return tool


@router.patch("/{tool_id}/online-status")
def update_tool_online_status_endpoint(
    tool_id: int,
    is_online: bool,
) -> Any:
    """
    更新工具在线状态
    """
    with session_getter() as session:
        tool = update_tool_online_status(session, tool_id, is_online)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        return tool


@router.post("/{tool_id}/test")
async def test_tool(tool_id: int):
    """
    测试工具的可用性
    """
    with session_getter() as session:
        success, message = await test_tool_availability(session, tool_id)
        if success:
            return {"status": "success", "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
