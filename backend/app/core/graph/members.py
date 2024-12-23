from collections.abc import Mapping, Sequence
from typing import Annotated, Any

from app.core.workflow.node.state import format_messages
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, AnyMessage
from langchain_core.output_parsers.openai_tools import JsonOutputKeyToolsParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import (
    RunnableConfig,
    RunnableLambda,
    RunnableSerializable,
)
from langchain_core.tools import BaseTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
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
        qdrant_store = QdrantStore()
        retriever = qdrant_store.retriever(self.owner_id, self.upload_id)
        return create_retriever_tool_custom_modified(retriever)


class GraphPerson(BaseModel):
    name: str = Field(description="The name of the person")
    role: str = Field(description="Role of the person")
    provider: str = Field(description="The provider for the llm model")
    model: str = Field(description="The llm model to use for this person")

    api_key: str | None = Field(description="The api key")

    base_url: str | None = Field(description="The base url")

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

    api_key: str = Field(description="The api key")

    base_url: str = Field(description="The base url")
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


class TeamState(TypedDict):
    all_messages: Annotated[
        list[AnyMessage], add_messages
    ]  # Stores all messages in this thread
    messages: Annotated[list[AnyMessage], add_or_replace_messages]
    history: Annotated[list[AnyMessage], add_messages]
    team: GraphTeam
    next: str
    main_task: list[AnyMessage]
    task: list[
        AnyMessage
    ]  # This is the current task to be perform by a team member. Its a list because Worker's MessagesPlaceholder only accepts list of messages.


# When returning teamstate, is it possible to exclude fields that you dont want to update
class ReturnTeamState(TypedDict):
    all_messages: NotRequired[list[AnyMessage]]
    messages: NotRequired[list[AnyMessage]]
    history: NotRequired[list[AnyMessage]]
    team: NotRequired[GraphTeam]
    next: NotRequired[str | None]  # Returning None is valid for sequential graphs only
    task: NotRequired[list[AnyMessage]]


class BaseNode:
    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
        temperature: float,
    ):
        
        if provider in ["zhipuai", "siliconflow", "qwen"] and api_key and base_url:

            self.model = ChatOpenAI(
                model=model,
                streaming=True,
                api_key=api_key,
                base_url=base_url,
                temperature=temperature,
            )
            self.final_answer_model = ChatOpenAI(
                model=model,
                streaming=True,
                api_key=api_key,
                base_url=base_url,
                temperature=0,
            )
        elif provider in ["google"] and api_key:

            self.model = ChatGoogleGenerativeAI(
                model=model,
                temperature=temperature,
                google_api_key=api_key,
            )
            self.final_answer_model = ChatGoogleGenerativeAI(
                model=model,
                temperature=0,
                google_api_key=api_key,
            )

        elif provider in ["openai"] and base_url:
            self.model = init_chat_model(
                model,
                model_provider=provider,
                base_url=base_url,
                temperature=temperature,
            )
            self.final_answer_model = ChatOpenAI(
                model=model,
                temperature=0,
                streaming=True,
                api_key=api_key,
                base_url=base_url,
            )
        elif provider == "ollama":
            self.model = ChatOllama(
                model=model,
                temperature=temperature,
                base_url=(
                    base_url if base_url else "http://host.docker.internal:11434"
                ),
            )
            self.final_answer_model = ChatOllama(
                model=model,
                temperature=0,
                streaming=True,
                api_key=api_key,
                base_url=base_url,
            )
        else:
            self.model = init_chat_model(
                model,
                model_provider=provider,
                temperature=temperature,
                streaming=True,
                api_key=api_key,
                base_url=base_url,
            )
            self.final_answer_model = init_chat_model(
                model,
                model_provider=provider,
                temperature=temperature,
                streaming=True,
                api_key=api_key,
                base_url=base_url,
            )

    def tag_with_name(self, ai_message: AIMessage, name: str) -> AIMessage:
        """Tag a name to the AI message"""
        ai_message.name = name
        return ai_message

    def get_team_members_name(
        self, team_members: Mapping[str, GraphMember | GraphLeader]
    ) -> str:
        """Get the names of all team members as a string"""
        return ",".join(list(team_members))

    async def _handle_messages(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
        chain: RunnableSerializable[Any, Any],
    ) -> AIMessage:
        """Handle both regular messages and image messages in a unified way"""
        all_messages = state.get("all_messages", [])

        if (
            all_messages
            and isinstance(all_messages[-1].content, list)
            and any(
                isinstance(item, dict)
                and "type" in item
                and item["type"] in ["text", "image_url"]
                for item in all_messages[-1].content
            )
        ):
            from langchain_core.messages import HumanMessage

            temp_state = [HumanMessage(content=all_messages[-1].content, name="user")]
            return await self.model.ainvoke(temp_state, config)

        return await chain.ainvoke(state, config)


class WorkerNode(BaseNode):
    worker_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are a team member of {team_name} and you are one of the following team members: {team_members_name}.\n"
                    "Your team members (and other teams) will collaborate with you with their own set of skills. "
                    "You are chosen by one of your team member to perform this task. Try your best to perform it using your skills. "
                    "Stay true to your persona and role:\n{persona}\n"
                ),
            ),
            (
                "human",
                "Here is the task: \n\n {task_string} \n\n Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ]
    )

    def convert_output_to_ai_message(self, agent_output: dict[str, str]) -> AIMessage:
        """Convert agent executor output to ai message"""
        output = agent_output["output"]
        return AIMessage(content=output)

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        name = state["next"]
        member = state["team"].members[name]
        assert isinstance(member, GraphMember), "member is unexpectedly not a Member"
        team_members_name = self.get_team_members_name(state["team"].members)
        prompt = self.worker_prompt.partial(
            team_name=state["team"].name,
            team_members_name=team_members_name,
            persona=member.persona,
            history_string=format_messages(state["history"]),
            task_string=format_messages(state["task"]),
        )
        # If member has no tools, then use a regular model instead of an agent
        if len(member.tools) >= 1:
            tools: Sequence[BaseTool] = [tool.tool for tool in member.tools]
            chain = prompt | self.model.bind_tools(tools)
        else:
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = (  # type: ignore[no-redef]
                prompt | self.model
            )
        work_chain: RunnableSerializable[dict[str, Any], Any] = chain | RunnableLambda(
            self.tag_with_name  # type: ignore[arg-type]
        ).bind(name=member.name)

        result: AIMessage = await self._handle_messages(state, config, work_chain)

        if result.tool_calls:
            return {"messages": [result]}
        else:
            return {
                "history": [result],
                "messages": [],
                "all_messages": state["messages"] + [result],
            }


class SequentialWorkerNode(WorkerNode):
    """Perform Sequential Worker actions"""

    worker_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "Perform the task given to you.\n"
                    "If you are unable to perform the task, that's OK, another member with different tools "
                    "will help where you left off. Do not attempt to communicate with other members. "
                    "Execute what you can to make progress. "
                    "Stay true to your persona and role:\n{persona}\n\n"
                ),
            ),
            (
                "human",
                "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ]
    )

    def get_next_member_in_sequence(
        self, members: Mapping[str, GraphMember | GraphLeader], current_name: str
    ) -> str | None:
        member_names = list(members.keys())
        next_index = member_names.index(current_name) + 1
        if next_index < len(members):
            return member_names[member_names.index(current_name) + 1]
        else:
            return None

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        team = state["team"]  # This is actually the first member masked as a team.
        name = state["next"]
        member = team.members[name]
        assert isinstance(member, GraphMember), "member is unexpectedly not a Member"
        prompt = self.worker_prompt.partial(
            persona=member.persona, history_string=format_messages(state["history"])
        )
        # If member has no tools, then use a regular model instead of an agent
        if len(member.tools) >= 1:
            tools: Sequence[BaseTool] = [tool.tool for tool in member.tools]
            chain = prompt | self.model.bind_tools(tools)
        else:
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = (  # type: ignore[no-redef]
                prompt | self.model
            )
        work_chain: RunnableSerializable[dict[str, Any], Any] = chain | RunnableLambda(
            self.tag_with_name  # type: ignore[arg-type]
        ).bind(name=member.name)

        result: AIMessage = await self._handle_messages(state, config, work_chain)

        next: str | None
        if result.tool_calls:
            next = name
            return {"messages": [result], "next": name}
        else:
            next = self.get_next_member_in_sequence(team.members, name)
            return {
                "history": [result],
                "messages": [],
                "next": next,
                "all_messages": state["messages"] + [result],
            }


class LeaderNode(BaseNode):
    leader_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are the team leader of {team_name} and this is your role and you have the following team members: {team_members_name}.\n"
                    "Your team is given a task and you have to delegate the work among your team members based on their skills.\n"
                    "Team member info:"
                    "\n\n{team_members_info}\n\n"
                    "Stay true to your persona:"
                    "\n\n{persona}\n\n"
                    "Given the conversation, decide who should act next. Or should we FINISH? Select one of: {options}."
                ),
            ),
            (
                "human",
                (
                    "Here is the team's task: \n\n {team_task} \n\n Here is the previous conversation: \n\n {history_string} \n\n"
                    "Given the conversation, decide who should act next. Or should we FINISH? Select one of: {options}."
                ),
            ),
        ]
    )

    def get_team_members_info(
        self, team_members: Mapping[str, GraphMember | GraphLeader]
    ) -> str:
        """Create a string containing team members name and role."""
        result = ""
        for member in team_members.values():
            result += f"name: {member.name}\nrole: {member.role}\n\n"
        return result

    def get_tool_definition(self, options: list[str]) -> dict[str, Any]:
        """Return the tool definition to choose next team member and provide the task."""
        return {
            "type": "function",
            "function": {
                "name": "route",
                "description": (
                    "Provide both a task and the next most appropriate team member to perform it."
                    "\n'next' - The team member you should call."
                    "\n'task' - The task given to the team member."
                    "\nYou must provide both 'task' and 'next'."
                    "\n\nExample:"
                    "\nQn: How to cook food?"
                    '\n{"task": "Provide cooking instructions", "next": "CookingExpert"}'
                    "\n\nQn: How do you play soccer?"
                    '\n{"task": "Provide advice to play soccer", "next": "SoccerTeam"}'
                    "\n\nQn: How to make a dog happy?"
                    "\nAns: Pat its head and rub its belly"
                    '\n{"task": "No further tasks", "next": "FINISH"}'
                ),
                "parameters": {
                    "title": "routeSchema",
                    "type": "object",
                    "properties": {
                        "task": {
                            "title": "task",
                            "description": "Provide the next task only if answer is still incomplete. Else say no further task.",
                        },
                        "next": {
                            "title": "next",
                            "description": "Choose the next most appropriate team member if answer is still incomplete. Else choose FINISH.",
                            "anyOf": [
                                {"enum": options},
                            ],
                        },
                    },
                    "required": ["next", "task"],
                },
            },
        }

    async def delegate(
        self, state: TeamState, config: RunnableConfig
    ) -> dict[str, Any]:
        team = state["team"]  # This is the current node
        team_members_name = self.get_team_members_name(team.members)
        team_members_info = self.get_team_members_info(team.members)
        options = list(team.members) + ["FINISH"]
        tools = [self.get_tool_definition(options)]
        # Disable default parallel tool calls from ChatOpenAI
        if isinstance(self.model, ChatOpenAI):
            bind_tool = self.model.bind_tools(tools=tools, parallel_tool_calls=False)
        else:
            bind_tool = self.model.bind_tools(tools=tools)
        delegate_chain: RunnableSerializable[Any, Any] = (
            self.leader_prompt.partial(
                team_name=team.name,
                team_members_name=team_members_name,
                team_members_info=team_members_info,
                persona=team.persona,
                team_task=state["main_task"][0].content,
                history_string=format_messages(state["history"]),
                options=str(options),
            )
            | bind_tool
            | JsonOutputKeyToolsParser(key_name="route", first_tool_only=True)
        )

        result: AIMessage = await self._handle_messages(state, config, delegate_chain)

        if not result or result.get("next") is None or result["next"] == "FINISH":
            return {
                "next": "FINISH",
                "task": [AIMessage(content="Task completed.", name=team.name)],
            }
        else:
            task_content: str = str(result.get("task", state["main_task"][0].content))
            tasks = [AIMessage(content=task_content, name=team.name)]
            result["task"] = tasks
            result["all_messages"] = tasks
            return result

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        # 这个方法应该包含 delegate 方法的逻辑
        return await self.delegate(state, config)


class SummariserNode(BaseNode):
    summariser_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are a team member of {team_name} and you have the following team members: {team_members_name}. "
                    "Your team was given a task and your team members have performed their roles and returned their responses to the team leader.\n\n"
                    "Your role is to interpret the team's conversation and provide the final answer to the team's task.\n"
                ),
            ),
            (
                "human",
                "Here is the team's task: \n\n {team_task} \n\n Here is the team's conversation: \n\n {history_string} \n\n Provide your response.",
            ),
        ]
    )

    async def summarise(
        self, state: TeamState, config: RunnableConfig
    ) -> dict[str, list[AnyMessage]]:
        team = state["team"]
        team_members_name = self.get_team_members_name(team.members)
        # TODO: optimise looking for task
        team_task = state["main_task"][0].content

        summarise_chain: RunnableSerializable[Any, Any] = (
            self.summariser_prompt.partial(
                team_name=team.name,
                team_members_name=team_members_name,
                team_task=team_task,
                history_string=format_messages(state["history"]),
            )
            | self.final_answer_model
            | RunnableLambda(self.tag_with_name).bind(name=f"{team.name}_answer")  # type: ignore[arg-type]
        )
        result = await summarise_chain.ainvoke(state, config)
        return {"history": [result], "all_messages": [result]}


class ChatBotNode(BaseNode):
    worker_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "Execute what you can to make progress. "
                    "Stay true to your persona and role:\n{persona}\n\n"
                ),
            ),
            (
                "human",
                "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ]
    )

    def convert_output_to_ai_message(self, agent_output: dict[str, str]) -> AIMessage:
        """Convert agent executor output to ai message"""
        output = agent_output["output"]
        return AIMessage(content=output)

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        name = state["next"]
        member = state["team"].members[name]
        assert isinstance(member, GraphMember), "member is unexpectedly not a Member"

        prompt = self.worker_prompt.partial(
            persona=member.persona, history_string=format_messages(state["history"])
        )
        # If member has no tools, then use a regular model instead of an agent
        if len(member.tools) >= 1:
            tools: Sequence[BaseTool] = [tool.tool for tool in member.tools]
            chain = prompt | self.model.bind_tools(tools)
        else:
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = (  # type: ignore[no-redef]
                prompt | self.model
            )
        work_chain: RunnableSerializable[dict[str, Any], Any] = chain | RunnableLambda(
            self.tag_with_name  # type: ignore[arg-type]
        ).bind(name=member.name)

        result: AIMessage = await self._handle_messages(state, config, work_chain)

        if result.tool_calls:
            return {"messages": [result]}
        else:
            return {
                "history": [result],
                "messages": [],
                "all_messages": state["messages"] + [result],
            }


class RAGBotNode(BaseNode):
    worker_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are an assistant for question-answering tasks. "
                    "Use the following pieces of retrieved context to answer "
                    "the question. If you don't know the answer, say that you "
                    "don't know. Use three sentences maximum and keep the answer concise."
                    "Stay true to your persona and role:\n{persona}\n\n"
                ),
            ),
            (
                "human",
                "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ]
    )

    def convert_output_to_ai_message(self, agent_output: dict[str, str]) -> AIMessage:
        """Convert agent executor output to ai message"""
        output = agent_output["output"]
        return AIMessage(content=output)

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        name = state["next"]
        member = state["team"].members[name]
        assert isinstance(member, GraphMember), "member is unexpectedly not a Member"

        prompt = self.worker_prompt.partial(
            persona=member.persona, history_string=format_messages(state["history"])
        )
        # If member has no tools, then use a regular model instead of an agent
        if len(member.tools) >= 1:
            tools: Sequence[BaseTool] = [tool.tool for tool in member.tools]
            chain = prompt | self.model.bind_tools(tools)
        else:
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = (  # type: ignore[no-redef]
                prompt | self.model
            )
        work_chain: RunnableSerializable[dict[str, Any], Any] = chain | RunnableLambda(
            self.tag_with_name  # type: ignore[arg-type]
        ).bind(name=member.name)

        result: AIMessage = await self._handle_messages(state, config, work_chain)

        if result.tool_calls:
            return {"messages": [result]}
        else:
            return {
                "history": [result],
                "messages": [],
                "all_messages": state["messages"] + [result],
            }
