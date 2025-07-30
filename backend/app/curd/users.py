from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.db.models import User, UserCreate, UserGroup, UserRole, UserUpdate


def create_user(*, session: Session, user_create: UserCreate) -> User:
    """
    Create new user.
    """
    db_obj = User(
        email=user_create.email,
        hashed_password=get_password_hash(user_create.password),
        full_name=user_create.full_name,
        is_superuser=user_create.is_superuser,
        is_active=user_create.is_active,
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)

    # 添加用户组关联
    if hasattr(user_create, "groups"):
        for group_id in user_create.groups:
            user_group = UserGroup(user_id=db_obj.id, group_id=group_id)
            session.add(user_group)

    # 添加角色关联
    if hasattr(user_create, "roles"):
        for role_id in user_create.roles:
            user_role = UserRole(user_id=db_obj.id, role_id=role_id)
            session.add(user_role)

    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    """
    Update user.
    """
    user_data = user_in.model_dump(exclude_unset=True)

    # 处理密码
    if "password" in user_data:
        password = user_data.pop("password")
        if password:
            hashed_password = get_password_hash(password)
            user_data["hashed_password"] = hashed_password

    # 处理用户组
    if "groups" in user_data:
        groups = user_data.pop("groups")
        # 删除现有的用户组关联
        session.query(UserGroup).filter(UserGroup.user_id == db_user.id).delete()
        # 添加新的用户组关联
        for group_id in groups:
            user_group = UserGroup(user_id=db_user.id, group_id=group_id)
            session.add(user_group)

    # 处理角色
    if "roles" in user_data:
        roles = user_data.pop("roles")
        # 删除现有的角色关联
        session.query(UserRole).filter(UserRole.user_id == db_user.id).delete()
        # 添加新的角色关联
        for role_id in roles:
            user_role = UserRole(user_id=db_user.id, role_id=role_id)
            session.add(user_role)

    db_user.sqlmodel_update(user_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user
