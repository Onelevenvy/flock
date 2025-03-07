from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class MCPResource(BaseModel):
    """Resource model for files and API responses"""
    id: str = Field(..., description="Resource identifier")
    type: str = Field(..., description="Resource type (file/api)")
    server: str = Field(..., description="Server name")
    content_type: str = Field(default="application/json", description="Content type")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Resource metadata")
    ttl: Optional[int] = Field(None, description="Time to live in seconds")
    
    class Config:
        arbitrary_types_allowed = True 