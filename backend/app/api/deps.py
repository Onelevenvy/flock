from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

from app.core.config import settings
from app.core.db import engine
from app.core.security import resource_manager, security_manager
from app.db.models import ActionType, ResourceType, Team, TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security_manager.jwt_algorithm]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user


def check_team_permission(
    session: SessionDep,
    current_user: CurrentUser,
    resource_type: ResourceType,
    action_type: ActionType,
) -> None:
    """Check if user has permission to perform action on team"""
    resource_manager.check_permission(
        session=session,
        user=current_user,
        resource_type=resource_type,
        action_type=action_type,
    )


header_scheme = APIKeyHeader(name="x-api-key")


def get_current_team_from_key(
    session: SessionDep,
    team_id: int,
    key: str = Depends(header_scheme),
) -> Team:
    """Return team if apikey belongs to it"""
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    verified = False
    for apikey in team.apikeys:
        if security_manager.verify_password(key, apikey.hashed_key):
            verified = True
            break
    if not verified:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return team


CurrentTeam = Annotated[Team, Depends(get_current_team_from_key)]
TeamPermissionChecker = Annotated[None, Depends(check_team_permission)]
