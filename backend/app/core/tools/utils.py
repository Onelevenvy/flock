from sqlmodel import select

from app.core.database import get_session
from app.models import Skill


def get_tool_credentials(tool_name: str) -> dict:
    session = next(get_session())
    try:
        skill = session.exec(
            select(Skill).where(Skill.display_name == tool_name)
        ).first()
        if skill and skill.credentials:
            return skill.credentials
    finally:
        session.close()
    return {}


def get_credential_value(tool_name: str, credential_key: str) -> str:
    credentials = get_tool_credentials(tool_name)
    return credentials.get(credential_key, {}).get("value", "")
