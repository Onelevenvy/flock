from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.db.models import (Member, MemberCreate, MemberOut, MembersOut,
                           MemberUpdate, Message, Team, Tool, Upload)

router = APIRouter()


def validate_name_on_create(
    session: SessionDep, team_id: int, member_in: MemberCreate
) -> None:
    """Check if (name, team_id) is unique and name is not a protected name"""
    if member_in.name in settings.PROTECTED_NAMES:
        raise HTTPException(
            status_code=400, detail="Name is a protected name. Choose another name."
        )
    statement = select(Member).where(
        Member.name == member_in.name,
        Member.belongs_to == team_id,
    )
    member_unique = session.exec(statement).first()
    if member_unique:
        raise HTTPException(
            status_code=400, detail="Member with this name already exists"
        )


def validate_names_on_update(
    session: SessionDep, team_id: int, member_in: MemberUpdate, id: int
) -> None:
    """Check if (name, team_id) is unique and name is not a protected name"""
    if member_in.name in settings.PROTECTED_NAMES:
        raise HTTPException(
            status_code=400, detail="Name is a protected name. Choose another name."
        )
    statement = select(Member).where(
        Member.name == member_in.name,
        Member.belongs_to == team_id,
        Member.id != id,
    )
    member_unique = session.exec(statement).first()
    if member_unique:
        raise HTTPException(
            status_code=400, detail="Member with this name already exists"
        )


@router.get("/", response_model=MembersOut)
def read_members(
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve members from team.
    """
    # TODO: Use new way of getting members from teams. Get team first then use team.members
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Member)
        count = session.exec(count_statement).one()
        statement = (
            select(Member).where(Member.belongs_to == team_id).offset(skip).limit(limit)
        )
        members = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Member)
            .join(Team)
            .where(Team.owner_id == current_user.id, Member.belongs_to == team_id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Member)
            .join(Team)
            .where(Team.owner_id == current_user.id, Member.belongs_to == team_id)
            .offset(skip)
            .limit(limit)
        )
        members = session.exec(statement).all()

    return MembersOut(data=members, count=count)


@router.get("/{id}", response_model=MemberOut)
def read_member(
    session: SessionDep, current_user: CurrentUser, team_id: int, id: int
) -> Any:
    """
    Get member by ID.
    """
    if current_user.is_superuser:
        statement = (
            select(Member)
            .join(Team)
            .where(Member.id == id, Member.belongs_to == team_id)
        )
        member = session.exec(statement).first()
    else:
        statement = (
            select(Member)
            .join(Team)
            .where(
                Member.id == id,
                Member.belongs_to == team_id,
                Team.owner_id == current_user.id,
            )
        )
        member = session.exec(statement).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("/", response_model=MemberOut)
def create_member(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    member_in: MemberCreate,
    _: bool = Depends(validate_name_on_create),
) -> Any:
    """
    Create new member.
    """
    if not current_user.is_superuser:
        team = session.get(Team, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")
        if team.owner_id != current_user.id:
            raise HTTPException(status_code=400, detail="Not enough permissions")
    member = Member.model_validate(member_in, update={"belongs_to": team_id})
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.put("/{id}", response_model=MemberOut)
def update_member(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    team_id: int,
    id: int,
    member_in: MemberUpdate,
    _: bool = Depends(validate_names_on_update),
) -> Any:
    """
    Update a member.
    """
    if current_user.is_superuser:
        statement = (
            select(Member)
            .join(Team)
            .where(Member.id == id, Member.belongs_to == team_id)
        )
        member = session.exec(statement).first()
    else:
        statement = (
            select(Member)
            .join(Team)
            .where(
                Member.id == id,
                Member.belongs_to == team_id,
                Team.owner_id == current_user.id,
            )
        )
        member = session.exec(statement).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # update member's skills if required
    if member_in.tools is not None:
        tool_ids = [skill.id for skill in member_in.tools]
        tools = session.exec(select(Tool).where(col(Tool.id).in_(tool_ids))).all()
        member.tools = list(tools)

    # update member's accessible uploads if required
    if member_in.uploads is not None:
        upload_ids = [upload.id for upload in member_in.uploads]
        uploads = session.exec(
            select(Upload).where(col(Upload.id).in_(upload_ids))
        ).all()
        member.uploads = list(uploads)

    update_dict = member_in.model_dump(exclude_unset=True)
    member.sqlmodel_update(update_dict)
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.delete("/{id}")
def delete_member(
    session: SessionDep, current_user: CurrentUser, team_id: int, id: int
) -> Message:
    """
    Delete a member.
    """
    if current_user.is_superuser:
        statement = (
            select(Member)
            .join(Team)
            .where(Member.id == id, Member.belongs_to == team_id)
        )
        member = session.exec(statement).first()
    else:
        statement = (
            select(Member)
            .join(Team)
            .where(
                Member.id == id,
                Member.belongs_to == team_id,
                Team.owner_id == current_user.id,
            )
        )
        member = session.exec(statement).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    session.delete(member)
    session.commit()
    return Message(message="Member deleted successfully")
