from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.curd import groups
from app.db.models import (Group, GroupCreate, GroupOut, GroupsOut,
                           GroupUpdate, Message)

router = APIRouter()


@router.get("/", response_model=GroupsOut)
def read_groups(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve groups.
    """
    count_statement = select(func.count()).select_from(Group)
    count = session.exec(count_statement).one()

    statement = (
        select(Group).options(selectinload(Group.admin)).offset(skip).limit(limit)
    )
    groups_list = session.exec(statement).all()

    return GroupsOut(data=groups_list, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=GroupOut
)
def create_group(*, session: SessionDep, group_in: GroupCreate) -> Any:
    """
    Create new group.
    """
    group = groups.get_group_by_name(session=session, name=group_in.name)
    if group:
        raise HTTPException(
            status_code=400,
            detail="The group with this name already exists in the system.",
        )

    group = groups.create_group(session=session, group_create=group_in)
    return group


@router.get("/{group_id}", response_model=GroupOut)
def read_group_by_id(group_id: int, session: SessionDep) -> Any:
    """
    Get a specific group by id.
    """
    statement = (
        select(Group).options(selectinload(Group.admin)).where(Group.id == group_id)
    )
    group = session.exec(statement).first()
    if not group:
        raise HTTPException(
            status_code=404,
            detail="The group with this id does not exist in the system",
        )
    return group


@router.patch(
    "/{group_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=GroupOut,
)
def update_group(
    *,
    session: SessionDep,
    group_id: int,
    group_in: GroupUpdate,
) -> Any:
    """
    Update a group.
    """
    db_group = session.get(Group, group_id)
    if not db_group:
        raise HTTPException(
            status_code=404,
            detail="The group with this id does not exist in the system",
        )
    if group_in.name:
        existing_group = groups.get_group_by_name(session=session, name=group_in.name)
        if existing_group and existing_group.id != group_id:
            raise HTTPException(
                status_code=409, detail="Group with this name already exists"
            )

    db_group = groups.update_group(
        session=session, db_group=db_group, group_in=group_in
    )
    return db_group


@router.delete(
    "/{group_id}",
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_group(session: SessionDep, group_id: int) -> Message:
    """
    Delete a group.
    """
    group = session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.is_system_group:
        raise HTTPException(status_code=403, detail="System groups cannot be deleted")

    session.delete(group)
    session.commit()
    return Message(message="Group deleted successfully")
