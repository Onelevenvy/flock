from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.core.tools.api_tool import ToolDefinition
from app.core.tools.tool_invoker import ToolInvokeResponse, invoke_tool
from app.curd.tool import (_create_tool, _delete_tool, _update_tool,
                           get_all_tools, get_tools_by_provider,
                           update_tool_online_status)
from app.db.models import Tool, ToolBase, ToolCreate, ToolsOut, ToolUpdate

router = APIRouter()


from app.api.deps import SessionDep


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
def create_tool(tool: ToolCreate, session: SessionDep):
    """
    Create new tool.
    """

    # 验证工具定义
    if tool.tool_definition:
        validate_tool_definition(tool.tool_definition)
    return _create_tool(session, tool)


@router.get("/{provider_id}", response_model=ToolsOut)
def read_tool(provider_id: int, session: SessionDep):
    return get_tools_by_provider(session, provider_id)


@router.get("/", response_model=ToolsOut)
def read_tools(session: SessionDep, skip: int = 0, limit: int = 100):
    return get_all_tools(session, skip=skip, limit=limit)


@router.put("/{tool_id}", response_model=Tool)
def update_tool(tool_id: int, tool_update: ToolUpdate, session: SessionDep):
    """
    Update a tool.
    """

    if tool_update.tool_definition:
        validate_tool_definition(tool_update.tool_definition)

    tool = _update_tool(session, tool_id, tool_update)
    if tool is None:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.delete("/{tool_id}", response_model=Tool)
def delete_tool(tool_id: int, session: SessionDep):
    """
    Delete a tool.
    """

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
async def invoke_tools(tool_id: int, tool_name: str, args: dict) -> ToolInvokeResponse:
    """
    Invoke a tool by name with the provided arguments.
    """
    try:
        result = await invoke_tool(tool_id, tool_name, args)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{tool_id}/input-parameters")
def update_tool_input_parameters(
    tool_id: int,
    input_parameters: dict[str, Any],
    session: SessionDep,
) -> Any:
    """
    Update a tool's input parameters.
    """

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
    session: SessionDep,
) -> Any:
    """
    更新工具在线状态
    """

    tool = update_tool_online_status(session, tool_id, is_online)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.post("/{tool_id}/test")
async def test_tool(tool_id: int, session: SessionDep):
    """
    测试工具的可用性
    """

    success, message = await test_tool_availability(session, tool_id)
    if success:
        return {"status": "success", "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)
