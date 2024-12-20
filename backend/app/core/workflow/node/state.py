import re
from typing import Annotated, Any, Dict

from langchain_core.messages import AnyMessage, AIMessage,ToolMessage
from langchain_core.tools import BaseTool
from langgraph.graph import add_messages
from pydantic import BaseModel, Field
from typing_extensions import NotRequired, TypedDict

from app.core.rag.qdrant import QdrantStore
from app.core.tools import managed_tools
from app.core.tools.api_tool import dynamic_api_tool
from app.core.tools.retriever_tool import create_retriever_tool_custom_modified


class GraphSkill(BaseModel):
    name: str = Field(description="The name of the skill")
    definition: dict[str, Any] | None = Field(
        description="The skill definition. For api tool calling. Optional."
    )
    managed: bool = Field("Whether the skill is managed or user created.")

    @property
    def tool(self) -> BaseTool:
        if self.managed:
            return managed_tools[self.name].tool
        elif self.definition:
            return dynamic_api_tool(self.definition)
        else:
            raise ValueError("Skill is not managed and no definition provided.")


class GraphUpload(BaseModel):
    name: str = Field(description="Name of the upload")
    description: str = Field(description="Description of the upload")
    owner_id: int = Field(description="Id of the user that owns this upload")
    upload_id: int = Field(description="Id of the upload")

    @property
    def tool(self) -> BaseTool:
        retriever = QdrantStore().retriever(self.owner_id, self.upload_id)
        return create_retriever_tool_custom_modified(retriever)


class GraphPerson(BaseModel):
    name: str = Field(description="The name of the person")
    role: str = Field(description="Role of the person")
    provider: str = Field(description="The provider for the llm model")
    model: str = Field(description="The llm model to use for this person")

    openai_api_key: str = Field(description="The openai_api_key")

    openai_api_base: str = Field(description="The openai_api_base")

    temperature: float = Field(description="The temperature of the llm model")
    backstory: str = Field(
        description="Description of the person's experience, motives and concerns."
    )

    @property
    def persona(self) -> str:
        return f"<persona>\nName: {self.name}\nRole: {self.role}\nBackstory: {self.backstory}\n</persona>"


class GraphMember(GraphPerson):
    tools: list[GraphSkill | GraphUpload] = Field(
        description="The list of tools that the person can use."
    )
    interrupt: bool = Field(
        default=False,
        description="Whether to interrupt the person or not before skill use",
    )


# Create a Leader class so we can pass leader as a team member for team within team
class GraphLeader(GraphPerson):
    pass


class GraphTeam(BaseModel):
    name: str = Field(description="The name of the team")
    role: str = Field(description="Role of the team leader")
    backstory: str = Field(
        description="Description of the team leader's experience, motives and concerns."
    )
    members: dict[str, GraphMember | GraphLeader] = Field(
        description="The members of the team"
    )
    provider: str = Field(description="The provider of the team leader's llm model")
    model: str = Field(description="The llm model to use for this team leader")

    openai_api_key: str = Field(description="The openai_api_key")

    openai_api_base: str = Field(description="The openai_api_base")
    temperature: float = Field(
        description="The temperature of the team leader's llm model"
    )

    @property
    def persona(self) -> str:
        return f"Name: {self.name}\nRole: {self.role}\nBackstory: {self.backstory}\n"


def add_or_replace_messages(
    messages: list[AnyMessage], new_messages: list[AnyMessage]
) -> list[AnyMessage]:
    """Add new messages to the state. If new_messages list is empty, clear messages instead."""
    if not new_messages:
        return []
    else:
        return add_messages(messages, new_messages)  # type: ignore[return-value, arg-type]


def format_messages(messages: list[AnyMessage]) -> str:
    """Format list of messages to string"""
    message_str: str = ""
    for message in messages:
        # 确定消息名称
        name = message.name if message.name else (
            "AI" if isinstance(message, AIMessage) else
            "Tool" if isinstance(message, ToolMessage) else
            "User"
        )
        
        # 处理消息内容为列表的情况（包含图片的消息）
        if isinstance(message.content, list):
            # 提取所有文本内容
            text_contents = []
            for item in message.content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        text_contents.append(item.get("text", ""))
                    elif item.get("type") == "image_url":
                        text_contents.append("[图片]")
            content = " ".join(text_contents)
        else:
            content = message.content
            
        message_str += f"{name}: {content}\n\n"
    return message_str


def update_node_outputs(
    node_outputs: Dict[str, Any], new_outputs: Dict[str, Any]
) -> Dict[str, Any]:
    """Update node_outputs with new outputs. If new_outputs is empty, return the original node_outputs."""
    if not new_outputs:
        return node_outputs
    else:
        return {**node_outputs, **new_outputs}


class TeamState(TypedDict):
    all_messages: Annotated[list[AnyMessage], add_messages]
    messages: Annotated[list[AnyMessage], add_or_replace_messages]
    history: Annotated[list[AnyMessage], add_messages]
    team: GraphTeam
    next: str
    main_task: list[AnyMessage]
    task: list[AnyMessage]
    node_outputs: Annotated[Dict[str, Any], update_node_outputs]  # 修改这一行


# When returning teamstate, is it possible to exclude fields that you dont want to update
class ReturnTeamState(TypedDict):
    all_messages: NotRequired[list[AnyMessage]]
    messages: NotRequired[list[AnyMessage]]
    history: NotRequired[list[AnyMessage]]
    team: NotRequired[GraphTeam]
    next: NotRequired[str | None]  # Returning None is valid for sequential graphs only
    task: NotRequired[list[AnyMessage]]
    node_outputs: Annotated[Dict[str, Any], update_node_outputs]


def parse_variables(text: str, node_outputs: Dict, is_code: bool = False) -> str:
    def replace_variable(match):
        var_path = match.group(1).split(".")
        value = node_outputs
        for key in var_path:
            if key in value:
                value = value[key]
            else:
                return match.group(0)  # 如果找不到变量，保持原样
        
        # 转换全角字符为半角字符
        def convert_fullwidth_to_halfwidth(s: str) -> str:
            # 全角字符范围是 0xFF01 到 0xFF5E
            # 半角字符范围是 0x0021 到 0x007E
            result = []
            for char in str(s):
                code = ord(char)
                if 0xFF01 <= code <= 0xFF5E:
                    # 转换全角字符到半角字符
                    result.append(chr(code - 0xFEE0))
                else:
                    result.append(char)
            return ''.join(result)
        
        str_value = str(value)
        if is_code:
            # 对于代码中的字符串，需要转换全角字符并正确转义
            converted_value = convert_fullwidth_to_halfwidth(str_value)
            # 转义引号和反斜杠
            escaped_value = converted_value.replace('"', '\\"').replace("\\", "\\\\")
            return f'"{escaped_value}"'
        else:
            return str_value

    return re.sub(r"\{([^}]+)\}", replace_variable, text)
