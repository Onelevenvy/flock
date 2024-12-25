from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.security import generate_apikey, generate_short_apikey, get_password_hash
from app.models import ApiKey, ApiKeyCreate, ApiKeyOut, ApiKeysOutPublic, Message, Team

router = APIRouter()


@router.get("/", response_model=ApiKeysOutPublic)
def read_api_keys(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Read api keys"""
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(ApiKey)
        count = session.exec(count_statement).one()
        statement = (
            select(ApiKey).where(ApiKey.team_id == team_id).offset(skip).limit(limit)
        )
        apikeys = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(ApiKey)
            .join(Team)
            .where(Team.owner_id == current_user.id, ApiKey.team_id == team_id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(ApiKey)
            .join(Team)
            .where(Team.owner_id == current_user.id, ApiKey.team_id == team_id)
            .offset(skip)
            .limit(limit)
        )
        apikeys = session.exec(statement).all()
    return ApiKeysOutPublic(data=apikeys, count=count)


@router.post("/", response_model=ApiKeyOut)
def create_api_key(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    apikey_in: ApiKeyCreate,
) -> Any:
    """Create API key for a team."""
    # Check if the current user is not a superuser
    if not current_user.is_superuser:
        # Validate the provided team_id and check ownership
        team = session.get(Team, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")
        if team.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions.")
    # Generate API key and hash it
    key = generate_apikey()
    hashed_key = get_password_hash(key)
    short_key = generate_short_apikey(key)
    # Create the API key object
    description = apikey_in.description
    apikey = ApiKey(
        team_id=team_id,
        hashed_key=hashed_key,
        short_key=short_key,
        description=None if not description or not description.strip() else description,
    )
    # Save the new API key to the database
    session.add(apikey)
    session.commit()
    session.refresh(apikey)
    return ApiKeyOut(
        id=apikey.id,
        description=apikey.description,
        key=key,
        created_at=apikey.created_at,
    )


@router.delete("/{id}")
def delete_api_key(
    session: SessionDep, current_user: CurrentUser, team_id: int, id: int
) -> Any:
    """Delete API key for a team."""
    if current_user.is_superuser:
        statement = (
            select(ApiKey).join(Team).where(ApiKey.id == id, ApiKey.team_id == team_id)
        )
        apikey = session.exec(statement).first()
    else:
        statement = (
            select(ApiKey)
            .join(Team)
            .where(
                ApiKey.id == id,
                ApiKey.team_id == team_id,
                Team.owner_id == current_user.id,
            )
        )
        apikey = session.exec(statement).first()
    if not apikey:
        raise HTTPException(status_code=404, detail="Api key not found")
    session.delete(apikey)
    session.commit()
    return Message(message="Api key deleted successfully")
