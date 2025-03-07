from typing import Any, Dict, Type, TypeVar
from pydantic import BaseModel, ValidationError

from ..exceptions import MCPError
from ..models.tool import MCPTool, MCPToolParameter


T = TypeVar("T", bound=BaseModel)


def validate_model(model_class: Type[T], data: Dict[str, Any]) -> T:
    """Validate data against a Pydantic model"""
    try:
        return model_class(**data)
    except ValidationError as e:
        raise MCPError(f"Validation error: {str(e)}")


def validate_tool_params(tool: MCPTool, params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and process tool parameters"""
    # Check required parameters
    tool.validate_params(params)
    
    # Process parameters
    processed_params = {}
    for param in tool.parameters:
        value = params.get(param.name, param.default)
        if value is not None:
            processed_params[param.name] = value
            
    return processed_params 