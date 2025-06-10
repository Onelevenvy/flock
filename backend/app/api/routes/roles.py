from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.curd import roles
from app.models import Role, RoleCreate, RoleOut, RolesOut, RoleUpdate, Message

router = APIRouter()


@router.get("/", response_model=RolesOut)
def read_roles(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve roles.
    """
    count_statement = select(func.count()).select_from(Role)
    count = session.exec(count_statement).one()

    statement = select(Role).offset(skip).limit(limit)
    roles_list = session.exec(statement).all()

    return RolesOut(data=roles_list, count=count)


@router.post("/", dependencies=[Depends(get_current_active_superuser)], response_model=RoleOut)
def create_role(*, session: SessionDep, role_in: RoleCreate) -> Any:
    """
    Create new role.
    """
    role = roles.get_role_by_name(session=session, name=role_in.name)
    if role:
        raise HTTPException(
            status_code=400,
            detail="The role with this name already exists in the system.",
        )

    role = roles.create_role(session=session, role_create=role_in)
    return role


@router.get("/{role_id}", response_model=RoleOut)
def read_role_by_id(role_id: int, session: SessionDep) -> Any:
    """
    Get a specific role by id.
    """
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(
            status_code=404,
            detail="The role with this id does not exist in the system",
        )
    return role


@router.patch(
    "/{role_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=RoleOut,
)
def update_role(
    *,
    session: SessionDep,
    role_id: int,
    role_in: RoleUpdate,
) -> Any:
    """
    Update a role.
    """
    db_role = session.get(Role, role_id)
    if not db_role:
        raise HTTPException(
            status_code=404,
            detail="The role with this id does not exist in the system",
        )
    if role_in.name:
        existing_role = roles.get_role_by_name(session=session, name=role_in.name)
        if existing_role and existing_role.id != role_id:
            raise HTTPException(
                status_code=409, detail="Role with this name already exists"
            )

    db_role = roles.update_role(session=session, db_role=db_role, role_in=role_in)
    return db_role


@router.delete(
    "/{role_id}",
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_role(session: SessionDep, role_id: int) -> Message:
    """
    Delete a role.
    """
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role:
        raise HTTPException(status_code=403, detail="System roles cannot be deleted")

    session.delete(role)
    session.commit()
    return Message(message="Role deleted successfully") 