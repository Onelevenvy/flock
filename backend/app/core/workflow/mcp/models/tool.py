from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MCPToolParameter(BaseModel):
    """Tool parameter definition"""
    name: str = Field(..., description="Parameter name")
    type: str = Field(..., description="Parameter type")
    description: Optional[str] = Field(None, description="Parameter description")
    required: bool = Field(default=True, description="Whether the parameter is required")
    default: Optional[Any] = Field(None, description="Default value")


class MCPTool(BaseModel):
    """Tool definition model"""
    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description")
    parameters: List[MCPToolParameter] = Field(
        default_factory=list,
        description="Tool parameters"
    )
    server: str = Field(..., description="Server name")
    
    def validate_params(self, params: Dict[str, Any]) -> bool:
        """Validate parameters against tool definition"""
        # Check required parameters
        required_params = {p.name for p in self.parameters if p.required}
        provided_params = set(params.keys())
        
        if not required_params.issubset(provided_params):
            missing = required_params - provided_params
            raise ValueError(f"Missing required parameters: {missing}")
            
        return True 