from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentTeam, CurrentUser, SessionDep
from app.core.graph.checkpoint.utils import (
    convert_checkpoint_tuple_to_messages,
    get_checkpoint_tuples,
)
from app.models import (
    Message,
    Team,
    Thread,
    ThreadCreate,
    ThreadOut,
    ThreadRead,
    ThreadsOut,
    ThreadUpdate,
)

router = APIRouter()


@router.get("/", response_model=ThreadsOut)
def read_threads(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve threads
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Thread)
        count = session.exec(count_statement).one()
        statement = (
            select(Thread)
            .where(Thread.team_id == team_id)
            .offset(skip)
            .limit(limit)
            .order_by(col(Thread.updated_at).desc())
        )
        threads = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Thread)
            .join(Team)
            .where(Team.owner_id == current_user.id, Thread.team_id == team_id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Thread)
            .join(Team)
            .where(Team.owner_id == current_user.id, Thread.team_id == team_id)
            .offset(skip)
            .limit(limit)
            .order_by(col(Thread.updated_at).desc())
        )
        threads = session.exec(statement).all()
    return ThreadsOut(data=threads, count=count)


@router.get("/{id}", response_model=ThreadRead)
async def read_thread(
    session: SessionDep, current_user: CurrentUser, team_id: int, id: UUID
) -> Any:
    """
    Get thread and its last checkpoint by ID
    """
    if current_user.is_superuser:
        statement = (
            select(Thread)
            .join(Team)
            .where(
                Thread.id == id,
                Thread.team_id == team_id,
            )
        )
        thread = session.exec(statement).first()
    else:
        statement = (
            select(Thread)
            .join(Team)
            .where(
                Thread.id == id,
                Thread.team_id == team_id,
                Team.owner_id == current_user.id,
            )
        )
        thread = session.exec(statement).first()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    checkpoint_tuple = await get_checkpoint_tuples(str(thread.id))
    if checkpoint_tuple:
        messages = convert_checkpoint_tuple_to_messages(checkpoint_tuple)
    else:
        messages = []

    return ThreadRead(
        id=thread.id,
        query=thread.query,
        messages=messages,
        updated_at=thread.updated_at,
    )


@router.post("/", response_model=ThreadOut)
def create_thread(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    thread_in: ThreadCreate,
) -> Any:
    """
    Create new thread
    """
    if not current_user.is_superuser:
        team = session.get(Team, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")
        if team.owner_id != current_user.id:
            raise HTTPException(status_code=400, detail="Not enough permissions")
    thread = Thread.model_validate(
        thread_in, update={"team_id": team_id, "updated_at": datetime.now()}
    )
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.put("/{id}", response_model=ThreadOut)
def update_thread(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    id: UUID,
    thread_in: ThreadUpdate,
) -> Any:
    """
    Update a thread.
    """
    if current_user.is_superuser:
        statement = (
            select(Thread).join(Team).where(Thread.id == id, Thread.team_id == team_id)
        )
        thread = session.exec(statement).first()
    else:
        statement = (
            select(Thread)
            .join(Team)
            .where(
                Thread.id == id,
                Thread.team_id == team_id,
                Team.owner_id == current_user.id,
            )
        )
        thread = session.exec(statement).first()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    update_dict = thread_in.model_dump(exclude_unset=True)
    thread.sqlmodel_update(update_dict)
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


@router.delete("/{id}")
def delete_thread(
    session: SessionDep, current_user: CurrentUser, team_id: int, id: UUID
) -> Any:
    """
    Delete a thread.
    """
    if current_user.is_superuser:
        statement = (
            select(Thread)
            .join(Team)
            .where(
                Thread.id == id,
                Thread.team_id == team_id,
            )
        )
        thread = session.exec(statement).first()
    else:
        statement = (
            select(Thread)
            .join(Team)
            .where(
                Thread.id == id,
                Thread.team_id == team_id,
                Team.owner_id == current_user.id,
            )
        )
        thread = session.exec(statement).first()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    for checkpoint in thread.checkpoints:
        session.delete(checkpoint)

    session.delete(thread)
    session.commit()
    return Message(message="Thread deleted successfully")


@router.get("/public/{thread_id}", response_model=ThreadRead)
async def read_thread_public(
    session: SessionDep,
    thread_id: UUID,
    team: CurrentTeam,
) -> Any:
    """
    Get thread and its last checkpoint by ID
    """
    statement = (
        select(Thread)
        .join(Team)
        .where(
            Thread.id == thread_id,
            Thread.team_id == team.id,
        )
    )
    thread = session.exec(statement).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    checkpoint_tuple = await get_checkpoint_tuples(str(thread.id))
    if checkpoint_tuple:
        messages = convert_checkpoint_tuple_to_messages(checkpoint_tuple)
    else:
        messages = []
    return ThreadRead(
        id=thread.id,
        query=thread.query,
        messages=messages,
        updated_at=thread.updated_at,
    )
