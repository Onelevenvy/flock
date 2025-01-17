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
)

router = APIRouter()


async def validate_name_on_create(
    session: SessionDep, subgraph_in: SubgraphCreate
) -> None:
    """Validate that subgraph name is unique"""
    statement = select(Subgraph).where(Subgraph.name == subgraph_in.name)
    subgraph = session.exec(statement).first()
    if subgraph:
        raise HTTPException(status_code=400, detail="Subgraph name already exists")


async def validate_name_on_update(
    session: SessionDep, subgraph_in: SubgraphUpdate, id: int
) -> None:
    """Validate that subgraph name is unique"""
    statement = select(Subgraph).where(
        Subgraph.name == subgraph_in.name, Subgraph.id != id
    )
    subgraph = session.exec(statement).first()
    if subgraph:
        raise HTTPException(status_code=400, detail="Subgraph name already exists")


@router.get("/", response_model=SubgraphsOut)
def read_subgraphs(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve subgraphs.
    """
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Subgraph)
        count = session.exec(count_statement).one()
        statement = select(Subgraph).offset(skip).limit(limit)
        subgraphs = session.exec(statement).all()
    else:
        # 普通用户只能看到自己的和公开的子图
        count_statement = (
            select(func.count())
            .select_from(Subgraph)
            .where(
                (Subgraph.owner_id == current_user.id) | (Subgraph.is_public == True)
            )  # noqa: E712
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Subgraph)
            .where(
                (Subgraph.owner_id == current_user.id) | (Subgraph.is_public == True)
            )  # noqa: E712
            .offset(skip)
            .limit(limit)
        )
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
