from typing import Any

from sqlmodel import Session, select

from app.db.models import Role, RoleCreate, RoleUpdate


def create_role(*, session: Session, role_create: RoleCreate) -> Role:
    db_obj = Role.model_validate(role_create)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_role(*, session: Session, db_role: Role, role_in: RoleUpdate) -> Any:
    role_data = role_in.model_dump(exclude_unset=True)
    db_role.sqlmodel_update(role_data)
    session.add(db_role)
    session.commit()
    session.refresh(db_role)
    return db_role


def get_role_by_name(*, session: Session, name: str) -> Role | None:
    statement = select(Role).where(Role.name == name)
    session_role = session.exec(statement).first()
    return session_role
