from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class MCPServerConfig(BaseModel):
    """MCP server configuration model"""
    name: str = Field(..., description="Server name")
    command: str = Field(..., description="Command to start the server")
    args: List[str] = Field(default_factory=list, description="Command arguments")
    transport: str = Field(default="stdio", description="Transport protocol (stdio/websocket)")
    working_dir: Optional[str] = Field(None, description="Working directory")
    env: Dict[str, str] = Field(default_factory=dict, description="Environment variables")

    class Config:
        arbitrary_types_allowed = True 