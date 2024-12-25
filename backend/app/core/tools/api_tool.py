import json
import types
from enum import Enum
from typing import Any

import requests
from langchain.tools import StructuredTool
from langchain_core.tools import ToolException
from pydantic import BaseModel, Field, ValidationError, create_model, field_validator


class ParameterProperties(BaseModel):
    type: str
    description: str
    enum: list[str | int | float | bool] | None = None

    @field_validator("type")
    def type_must_be_valid(cls, v: Any) -> Any:
        if v not in {"string", "integer", "number", "boolean"}:
            raise ValueError("Unsupported type")
        return v


class Parameters(BaseModel):
    type: str = Field(default="object")
    properties: dict[str, ParameterProperties]
    required: list[str] | None = None

    @field_validator("type")
    def type_must_be_object(cls, v: Any) -> Any:
        if v != "object":
            raise ValueError("Parameters type must be object")
        return v


class FunctionInfo(BaseModel):
    name: str
    description: str
    parameters: Parameters


class ToolDefinition(BaseModel):
    function: FunctionInfo
    url: str
    method: str = Field(default="GET")
    headers: dict[str, str] | None = None

    @field_validator("method")
    def method_must_be_valid(cls, v: Any) -> Any:
        if v.upper() not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
            raise ValueError("Unsupported HTTP method")
        return v.upper()


class TempEnum(str, Enum):
    """Convert dict into Enum"""


def dynamic_api_tool(tool_definition: dict[str, Any]) -> StructuredTool:
    """
    Create a dynamic API tool from a JSON definition.

    :param tool_definition: The JSON definition of the tool.
    :return: A StructuredTool instance.
    """

    # Validate the tool definition
    try:
        validated_tool_definition = ToolDefinition(**tool_definition)
    except ValidationError as e:
        raise ValueError(f"Invalid tool definition: {e}")

    function_info = validated_tool_definition.function
    name = function_info.name
    description = function_info.description
    parameters = function_info.parameters
    required_fields = set(parameters.required or [])

    # Create the argument schema dynamically using pydantic
    fields = {}
    for arg, properties in parameters.properties.items():
        if properties.enum:
            field_type = TempEnum(  # type: ignore[call-overload]
                f"{arg}Enum", {str(en): en for en in properties.enum}
            )
        elif properties.type == "string":
            field_type = str
        elif properties.type == "integer":
            field_type = int
        elif properties.type == "number":
            field_type = float
        elif properties.type == "boolean":
            field_type = bool
        else:
            raise ValueError(f"Unsupported parameter type: {properties.type}")
        default = ... if arg in required_fields else None
        fields[arg] = (
            field_type,
            Field(default=default, description=properties.description),
        )

    DynamicInput = create_model(f"{name}Input", **fields)  # type: ignore[call-overload]

    def api_call(**kwargs: Any) -> str:
        """
        Executes an API call based on the provided tool definition.

        This function dynamically constructs and executes an API request using the
        parameters specified in the tool definition. It supports GET, POST, PUT,
        DELETE, PATCH, and any other HTTP method specified. The function handles
        response parsing and error handling.

        Args:
            **kwargs: Arbitrary keyword arguments representing the parameters to be
                    sent in the API request. These are used as query parameters
                    for GET requests and as JSON payload for POST, PUT, PATCH, and
                    DELETE requests.

        Returns:
            str: The JSON response from the API, formatted as a pretty-printed string.

        Raises:
            ToolException: If the HTTP request fails, the response cannot be decoded
                        as JSON, or any other unexpected error occurs during the
                        API call.
        """
        url = validated_tool_definition.url
        method = validated_tool_definition.method
        headers = validated_tool_definition.headers or {}

        # Prepare data and params based on the HTTP method
        if method in ["POST", "PUT", "PATCH", "DELETE"]:
            data = kwargs
            params = None
        else:
            data = None
            params = kwargs

        try:
            response = requests.request(
                method, url, headers=headers, json=data, params=params
            )
            response.raise_for_status()  # Raise an HTTPError for bad responses
            return json.dumps(response.json(), indent=2)
        except requests.RequestException as e:
            raise ToolException(f"HTTP request failed: {e}")
        except ValueError as e:
            raise ToolException(f"JSON decoding failed: {e}")
        except Exception as e:
            raise ToolException(f"An unexpected error occurred: {e}")

    api_call.__name__ = name
    api_call.__doc__ = description

    # Create a new function object dynamically
    dynamic_func = types.FunctionType(
        api_call.__code__,
        globals(),
        name,
        api_call.__defaults__,
        api_call.__closure__,
    )

    # Create a StructuredTool instance
    tool = StructuredTool.from_function(
        func=dynamic_func,
        name=name,
        description=description,
        args_schema=DynamicInput,
        return_direct=True,
        handle_tool_error=True,
    )

    return tool
