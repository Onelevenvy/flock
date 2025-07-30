from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep, check_team_permission
from app.core.security import resource_manager
from app.db.models import (ActionType, Graph, GraphCreate, GraphOut, GraphsOut,
                           GraphUpdate, ResourceType, Team)

router = APIRouter()


async def validate_name_on_create(session: SessionDep, graph_in: GraphCreate) -> None:
    """Validate that graph name is unique"""
    statement = select(Graph).where(Graph.name == graph_in.name)
    graph = session.exec(statement).first()
    if graph:
        raise HTTPException(status_code=400, detail="Graph name already exists")


async def validate_name_on_update(
    session: SessionDep, graph_in: GraphUpdate, id: int
) -> None:
    """Validate that graph name is unique"""
    if graph_in.name:
        statement = select(Graph).where(Graph.name == graph_in.name, Graph.id != id)
        graph = session.exec(statement).first()
        if graph:
            raise HTTPException(status_code=400, detail="Graph name already exists")


@router.get("/", response_model=GraphsOut)
def read_graphs(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve graphs from team.
    """
    # 检查权限
    check_team_permission(
        session=session,
        current_user=current_user,
        resource_type=ResourceType.GRAPH,
        action_type=ActionType.READ,
    )

    # 获取所有图表
    count_statement = (
        select(func.count()).select_from(Graph).where(Graph.team_id == team_id)
    )
    count = session.exec(count_statement).one()
    statement = select(Graph).where(Graph.team_id == team_id).offset(skip).limit(limit)
    graphs = session.exec(statement).all()

    return GraphsOut(data=graphs, count=count)


@router.get("/{id}", response_model=GraphOut)
def read_graph(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    id: int,
) -> Any:
    """
    Get graph by ID.
    """
    # 检查权限
    check_team_permission(
        session=session,
        current_user=current_user,
        resource_type=ResourceType.GRAPH,
        action_type=ActionType.READ,
    )

    statement = select(Graph).where(Graph.id == id, Graph.team_id == team_id)
    graph = session.exec(statement).first()

    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    return graph


@router.post("/", response_model=GraphOut)
def create_graph(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    graph_in: GraphCreate,
    _: bool = Depends(validate_name_on_create),
) -> Any:
    """
    Create new graph.
    """
    # 检查权限
    check_team_permission(
        session=session,
        current_user=current_user,
        resource_type=ResourceType.GRAPH,
        action_type=ActionType.CREATE,
    )

    # 检查team是否存在
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    # 创建graph对应的resource
    resource = resource_manager.create_resource(
        session=session,
        name=f"graph_{graph_in.name}",  # 使用graph名称作为resource名称
        description=graph_in.description or f"Graph resource for {graph_in.name}",
        resource_type=ResourceType.GRAPH,
    )

    # 创建graph
    graph = Graph.model_validate(
        graph_in,
        update={
            "team_id": team_id,
            "owner_id": current_user.id,
            "resource_id": resource.id,  # 设置resource_id
        },
    )
    session.add(graph)
    session.commit()
    session.refresh(graph)
    return graph


@router.put("/{id}", response_model=GraphOut)
def update_graph(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    id: int,
    graph_in: GraphUpdate,
) -> Any:
    """
    Update graph by ID.
    """
    # 检查权限
    check_team_permission(
        session=session,
        current_user=current_user,
        resource_type=ResourceType.GRAPH,
        action_type=ActionType.UPDATE,
    )

    graph = session.get(Graph, id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    graph_data = graph_in.model_dump(exclude_unset=True)
    for field in graph_data:
        setattr(graph, field, graph_data[field])

    session.add(graph)
    session.commit()
    session.refresh(graph)
    return graph


@router.delete("/{id}")
def delete_graph(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    id: int,
) -> Any:
    """
    Delete graph by ID.
    """
    # 检查权限
    check_team_permission(
        session=session,
        current_user=current_user,
        resource_type=ResourceType.GRAPH,
        action_type=ActionType.DELETE,
    )

    graph = session.get(Graph, id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    session.delete(graph)
    session.commit()
    return {"ok": True}
