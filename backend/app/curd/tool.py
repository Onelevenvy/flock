from sqlmodel import Session, select

from app.db.models import Tool, ToolCreate, ToolsOut, ToolUpdate


def _create_tool(session: Session, tool: ToolCreate) -> Tool:
    """创建工具"""
    db_tool = Tool.model_validate(tool)
    session.add(db_tool)
    session.commit()
    session.refresh(db_tool)
    return db_tool


def _update_tool(
    session: Session, tool_id: int, tool_update: ToolUpdate
) -> Tool | None:
    """更新工具"""
    db_tool = session.get(Tool, tool_id)
    if not db_tool:
        return None

    update_data = tool_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_tool, field, value)

    session.add(db_tool)
    session.commit()
    session.refresh(db_tool)
    return db_tool


def _delete_tool(session: Session, tool_id: int) -> Tool | None:
    """删除工具"""
    db_tool = session.get(Tool, tool_id)
    if not db_tool:
        return None

    session.delete(db_tool)
    session.commit()
    return db_tool


def get_tools_by_provider(session: Session, provider_id: int) -> ToolsOut:
    """获取提供者的所有工具"""
    tools = session.exec(select(Tool).where(Tool.provider_id == provider_id)).all()
    return ToolsOut(data=tools, count=len(tools))


def get_all_tools(session: Session, skip: int = 0, limit: int = 100) -> ToolsOut:
    """获取所有工具"""
    count = session.exec(select(Tool)).all()
    tools = session.exec(select(Tool).offset(skip).limit(limit)).all()
    return ToolsOut(data=tools, count=len(count))


def update_tool_online_status(
    session: Session, tool_id: int, is_online: bool
) -> Tool | None:
    """更新工具在线状态"""
    db_tool = session.get(Tool, tool_id)
    if not db_tool:
        return None

    db_tool.is_online = is_online
    session.add(db_tool)
    session.commit()
    session.refresh(db_tool)
    return db_tool
