from typing import Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep, CurrentTeam
from app.core.graph.build import generator
from app.models import (
    Member,
    Message,
    Team,
    TeamChat,
    TeamCreate,
    TeamOut,
    TeamsOut,
    TeamUpdate,
    Thread,
    TeamChatPublic,
)

router = APIRouter()

header_scheme = APIKeyHeader(name="x-api-key")


async def validate_name_on_create(session: SessionDep, team_in: TeamCreate) -> None:
    """Validate that team name is unique"""
    statement = select(Team).where(Team.name == team_in.name)
    team = session.exec(statement).first()
    if team:
        raise HTTPException(status_code=400, detail="Team name already exists")


async def validate_name_on_update(
    session: SessionDep, team_in: TeamUpdate, id: int
) -> None:
    """Validate that team name is unique"""
    statement = select(Team).where(Team.name == team_in.name, Team.id != id)
    team = session.exec(statement).first()
    if team:
        raise HTTPException(status_code=400, detail="Team name already exists")


@router.get("/", response_model=TeamsOut)
def read_teams(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve teams
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Team)
        count = session.exec(count_statement).one()
        statement = select(Team).offset(skip).limit(limit).order_by(col(Team.id).desc())
        teams = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Team)
            .where(Team.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Team)
            .where(Team.owner_id == current_user.id)
            .offset(skip)
            .limit(limit)
            .order_by(col(Team.id).desc())
        )
        teams = session.exec(statement).all()
    return TeamsOut(data=teams, count=count)


@router.get("/{id}", response_model=TeamOut)
def read_team(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Get team by ID.
    """
    team = session.get(Team, id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not current_user.is_superuser and (team.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return team


@router.post("/", response_model=TeamOut)
def create_team(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_in: TeamCreate,
    _: bool = Depends(validate_name_on_create),
) -> Any:
    """
    Create new team and it's team leader
    """
    team = Team.model_validate(team_in, update={"owner_id": current_user.id})
    if team.workflow not in [
        "hierarchical",
        "sequential",
        "chatbot",
        "ragbot",
        "workflow",
    ]:
        raise HTTPException(status_code=400, detail="Invalid workflow")
    session.add(team)
    session.commit()

    if team.workflow == "hierarchical":
        # Create team leader
        member = Member(
            # The leader name will be used as the team's name in the graph, so it has to be specific
            name=f"{team.name}Leader",
            type="root",
            role="Gather inputs from your team and answer the question.",
            owner_of=team.id,
            position_x=0,
            position_y=0,
            belongs_to=team.id,
        )
    elif team.workflow == "sequential":
        # Create a freelancer head
        member = Member(
            name="Worker0",
            type="freelancer_root",
            role="Answer the user's question.",
            owner_of=None,
            position_x=0,
            position_y=0,
            belongs_to=team.id,
        )
    elif team.workflow == "chatbot":
        # Create a freelancer head
        member = Member(
            name="ChatBot",
            type="chatbot",
            role="Answer the user's question.",
            owner_of=None,
            position_x=0,
            position_y=0,
            belongs_to=team.id,
        )
    elif team.workflow == "ragbot":
        # Create a freelancer head
        member = Member(
            name="RagBot",
            type="ragbot",
            role="Answer the user's question use knowledge base.",
            owner_of=None,
            position_x=0,
            position_y=0,
            belongs_to=team.id,
        )
    elif team.workflow == "workflow":
        # Create a freelancer head
        member = Member(
            name="Workflow",
            type="workflow",
            role="Answer the user's question.",
            owner_of=None,
            position_x=0,
            position_y=0,
            belongs_to=team.id,
        )
    else:
        raise ValueError("Unsupported graph type")
    session.add(member)
    session.commit()

    return team


@router.put("/{id}", response_model=TeamOut)
def update_team(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    team_in: TeamUpdate,
    _: bool = Depends(validate_name_on_update),
) -> Any:
    """
    Update a team.
    """
    team = session.get(Team, id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not current_user.is_superuser and (team.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    update_dict = team_in.model_dump(exclude_unset=True)
    team.sqlmodel_update(update_dict)
    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.delete("/{id}")
def delete_team(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Delete a team.
    """
    team = session.get(Team, id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not current_user.is_superuser and (team.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    session.delete(team)
    session.commit()
    return Message(message="Team deleted successfully")


@router.post("/{id}/stream/{thread_id}")
async def stream(
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    thread_id: str,
    team_chat: TeamChat,
) -> StreamingResponse:
    """
    Stream a response to a user's input.
    """
    # Get team and join members and skills
    team = session.get(Team, id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not current_user.is_superuser and (team.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")

    # Check if thread belongs to the team
    thread = session.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread.team_id != id:
        raise HTTPException(
            status_code=400, detail="Thread does not belong to the team"
        )

    # Populate the skills and accessible uploads for each member
    members = team.members
    for member in members:
        member.skills = member.skills
        member.uploads = member.uploads
    graphs = team.graphs
    for graph in graphs:
        graph.config = graph.config
    return StreamingResponse(
        generator(team, members, team_chat.messages, thread_id, team_chat.interrupt),
        media_type="text/event-stream",
    )



@router.post("/{team_id}/stream-public/{thread_id}")
async def public_stream(
    session: SessionDep,
    team_id: int,
    team_chat: TeamChatPublic,
    thread_id: str,
    team: CurrentTeam,
) -> StreamingResponse:
    """
    Stream a response from a team using a given message or an interrupt decision. Requires an API key for authentication.
    This endpoint allows streaming responses from a team based on a provided message or interrupt details. The request must include an API key for authorization.
    Parameters:
    - `team_id` (int): The ID of the team to which the message is being sent. Must be a valid team ID.
    - `thread_id` (str): The ID of the thread where the message will be posted. If the thread ID does not exist, a new thread will be created.
    Request Body (JSON):
    - The request body should be a JSON object containing either the `message` or `interrupt` field:
        - `message` (object, optional): The message to be sent to the team.
            - `type` (str): Must be `"human"`.
            - `content` (str): The content of the message to be sent.
        - `interrupt` (object, optional): Approve/reject tool or reply to an ask-human tool.
            - `decision` (str): Can be `'approved'`, `'rejected'`, or `'replied'`.
            - `tool_message` (str or null, optional): If `decision` is `'rejected'` or `'replied'`, provide a message explaining the reason for rejection or the reply.
    Authorization:
    - API key must be provided in the request header as `x-api-key`.
    Responses:
    - `200 OK`: Returns a streaming response in `text/event-stream` format containing the team's response.
    """
    # Check if thread belongs to the team
    thread = session.get(Thread, thread_id)
    message_content = team_chat.message.content if team_chat.message else ""
    if not thread:
        # create new thread
        thread = Thread(
            id=thread_id,
            query=message_content,
            updated_at=datetime.now(),
            team_id=team_id,
        )
        session.add(thread)
        session.commit()
        session.refresh(thread)
    else:
        if thread.team_id != team_id:
            raise HTTPException(
                status_code=400, detail="Thread does not belong to the team"
            )
    # Populate the skills and accessible uploads for each member
    members = team.members
    for member in members:
        member.skills = member.skills
        member.uploads = member.uploads
    messages = [team_chat.message] if team_chat.message else []
    return StreamingResponse(
        generator(team, members, messages, thread_id, team_chat.interrupt),
        media_type="text/event-stream",
    )