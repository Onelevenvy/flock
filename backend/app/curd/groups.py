from typing import Any

from sqlmodel import Session, select

from app.db.models import Group, GroupCreate, GroupUpdate


def create_group(*, session: Session, group_create: GroupCreate) -> Group:
    db_obj = Group.model_validate(group_create)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_group(*, session: Session, db_group: Group, group_in: GroupUpdate) -> Any:
    group_data = group_in.model_dump(exclude_unset=True)
    db_group.sqlmodel_update(group_data)
    session.add(db_group)
    session.commit()
    session.refresh(db_group)
    return db_group


def get_group_by_name(*, session: Session, name: str) -> Group | None:
    statement = select(Group).where(Group.name == name)
    session_group = session.exec(statement).first()
    return session_group
