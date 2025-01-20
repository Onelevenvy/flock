from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Subgraph,
    SubgraphCreate,
    SubgraphOut,
    SubgraphsOut,
    SubgraphUpdate,
    Team,
)

# 创建一个新的路由组，专门用于不需要team_id的操作
public_router = APIRouter()


async def validate_name_on_create(
    session: SessionDep, subgraph_in: SubgraphCreate
) -> None:
    """Validate that subgraph name is unique within the team"""
    statement = select(Subgraph).where(
        Subgraph.name == subgraph_in.name, Subgraph.team_id == subgraph_in.team_id
    )
    subgraph = session.exec(statement).first()
    if subgraph:
        raise HTTPException(
            status_code=400, detail="Subgraph name already exists in this team"
        )


async def validate_name_on_update(
    session: SessionDep, subgraph_in: SubgraphUpdate, id: int
) -> None:
    """Validate that subgraph name is unique within the team"""
    if not subgraph_in.name:
        return
    existing_subgraph = session.get(Subgraph, id)
    if not existing_subgraph:
        raise HTTPException(status_code=404, detail="Subgraph not found")

    statement = select(Subgraph).where(
        Subgraph.name == subgraph_in.name,
        Subgraph.team_id == existing_subgraph.team_id,
        Subgraph.id != id,
    )
    subgraph = session.exec(statement).first()
    if subgraph:
        raise HTTPException(
            status_code=400, detail="Subgraph name already exists in this team"
        )


@public_router.get("/all", response_model=SubgraphsOut)
def read_all_public_subgraphs(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve all public subgraphs.
    """
    # conditions = [Subgraph.is_public == True]  # noqa: E712
    conditions = []  # 移除is_public过滤条件

    count_statement = select(func.count()).select_from(Subgraph).where(*conditions)
    statement = select(Subgraph).where(*conditions).offset(skip).limit(limit)

    count = session.exec(count_statement).one()
    subgraphs = session.exec(statement).all()
    return SubgraphsOut(data=subgraphs, count=count)


# 原有的路由保持不变
router = APIRouter()


@router.get("/", response_model=SubgraphsOut)
def read_subgraphs(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve subgraphs.
    """
    conditions = []
    if not current_user.is_superuser:
        conditions.append(
            (Subgraph.owner_id == current_user.id)
            | (Subgraph.is_public == True)  # noqa: E712
        )

    if team_id is not None:
        conditions.append(Subgraph.team_id == team_id)

    where_clause = None
    if conditions:
        where_clause = conditions[0]
        for condition in conditions[1:]:
            where_clause = where_clause & condition

    if current_user.is_superuser and not team_id:
        count_statement = select(func.count()).select_from(Subgraph)
        statement = select(Subgraph).offset(skip).limit(limit)
    else:
        count_statement = select(func.count()).select_from(Subgraph).where(where_clause)
        statement = select(Subgraph).where(where_clause).offset(skip).limit(limit)

    count = session.exec(count_statement).one()
    subgraphs = session.exec(statement).all()
    return SubgraphsOut(data=subgraphs, count=count)


@router.get("/{id}", response_model=SubgraphOut)
def read_subgraph(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
) -> Any:
    """
    Get subgraph by ID.
    """
    subgraph = session.get(Subgraph, id)
    if not subgraph:
        raise HTTPException(status_code=404, detail="Subgraph not found")
    if (
        not current_user.is_superuser
        and not subgraph.is_public
        and subgraph.owner_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return subgraph


@router.post("/", response_model=SubgraphOut)
def create_subgraph(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    subgraph_in: SubgraphCreate,
    _: bool = Depends(validate_name_on_create),
) -> Any:
    """
    Create new subgraph.
    """
    # 验证team_id是否存在
    if not subgraph_in.team_id:
        raise HTTPException(status_code=400, detail="team_id is required")

    # 检查是否已存在同名subgraph在同一team中
    existing = session.exec(
        select(Subgraph).where(
            Subgraph.name == subgraph_in.name, Subgraph.team_id == subgraph_in.team_id
        )
    ).first()

    if existing:
        # 如果存在且用户有权限,则更新
        if existing.owner_id == current_user.id or current_user.is_superuser:
            update_dict = subgraph_in.model_dump(exclude_unset=True)
            existing.sqlmodel_update(update_dict)
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        else:
            raise HTTPException(
                status_code=403,
                detail="A subgraph with this name already exists in this team",
            )

    subgraph = Subgraph.model_validate(
        subgraph_in, update={"owner_id": current_user.id}
    )
    session.add(subgraph)
    session.commit()
    session.refresh(subgraph)
    return subgraph


@router.put("/{id}", response_model=SubgraphOut)
def update_subgraph(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    subgraph_in: SubgraphUpdate,
    _: bool = Depends(validate_name_on_update),
) -> Any:
    """
    Update subgraph by ID.
    """
    subgraph = session.get(Subgraph, id)
    if not subgraph:
        raise HTTPException(status_code=404, detail="Subgraph not found")
    if not current_user.is_superuser and subgraph.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    update_dict = subgraph_in.model_dump(exclude_unset=True)
    subgraph.sqlmodel_update(update_dict)
    session.add(subgraph)
    session.commit()
    session.refresh(subgraph)
    return subgraph


@router.delete("/{id}")
def delete_subgraph(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
) -> Message:
    """
    Delete subgraph by ID.
    """
    subgraph = session.get(Subgraph, id)
    if not subgraph:
        raise HTTPException(status_code=404, detail="Subgraph not found")
    if not current_user.is_superuser and subgraph.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(subgraph)
    session.commit()
    return Message(message="Subgraph deleted successfully")
