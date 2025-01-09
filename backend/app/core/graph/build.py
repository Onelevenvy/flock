import asyncio
from collections import defaultdict, deque
from collections.abc import AsyncGenerator, Hashable, Mapping
from functools import partial
from typing import Any, cast
from uuid import uuid4

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableLambda
from langchain_core.runnables.config import RunnableConfig
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import ToolNode
from psycopg import AsyncConnection
from langgraph.types import Command
from app.core.config import settings
from app.core.graph.members import (
    GraphLeader,
    GraphMember,
    GraphTeam,
    GraphTeamState,
    LeaderNode,
    SequentialWorkerNode,
    SummariserNode,
    WorkerNode,
)
from app.core.graph.messages import ChatResponse, event_to_response
from app.core.state import GraphSkill, GraphUpload
from app.core.workflow.build_workflow import initialize_graph
from app.models import ChatMessage, Interrupt, InterruptDecision, Member, Team


def convert_hierarchical_team_to_dict(
    team: Team, members: list[Member]
) -> dict[str, GraphTeam]:
    """
    Converts a team and its members into a dictionary representation.

    Args:
        team (Team): The team model to be converted.
        members (list[Member]): A list of member models belonging to the team.

    Returns:
        dict: A dictionary containing the team's information, with member details.

    Raises:
        ValueError: If the root leader is not found in the team.

    Notes:
        This function assumes that each team has a single root leader.
    """
    teams: dict[str, GraphTeam] = {}

    in_counts: defaultdict[int, int] = defaultdict(int)
    out_counts: defaultdict[int, list[int]] = defaultdict(list[int])
    members_lookup: dict[int, Member] = {}

    for member in members:
        assert member.id is not None, "member.id is unexpectedly None"
        if member.source:
            in_counts[member.id] += 1
            out_counts[member.source].append(member.id)
        else:
            in_counts[member.id] = 0
        members_lookup[member.id] = member

    queue: deque[int] = deque()

    for member_id in in_counts:
        if in_counts[member_id] == 0:
            queue.append(member_id)

    while queue:
        member_id = queue.popleft()
        member = members_lookup[member_id]
        if member.type == "root" or member.type == "leader":
            leader_name = member.name
            # Create the team definitions
            teams[leader_name] = GraphTeam(
                name=leader_name,
                model=member.model,
                role=member.role,
                backstory=member.backstory or "",
                members={},
                provider=member.provider,
                temperature=member.temperature,
            )
        # If member is not root team leader, add as a member
        if member.type != "root" and member.source:
            member_name = member.name
            leader = members_lookup[member.source]
            leader_name = leader.name
            if member.type == "worker":
                tools: list[GraphSkill | GraphUpload]
                tools = [
                    GraphSkill(
                        name=skill.name,
                        managed=skill.managed,
                        definition=skill.tool_definition,
                    )
                    for skill in member.skills
                ]
                tools += [
                    GraphUpload(
                        name=upload.name,
                        description=upload.description,
                        owner_id=upload.owner_id,
                        upload_id=cast(int, upload.id),
                    )
                    for upload in member.uploads
                    if upload.owner_id is not None
                ]
                teams[leader_name].members[member_name] = GraphMember(
                    name=member_name,
                    backstory=member.backstory or "",
                    role=member.role,
                    tools=tools,
                    provider=member.provider,
                    model=member.model,
                    temperature=member.temperature,
                    interrupt=member.interrupt,
                )
            elif member.type == "leader":
                teams[leader_name].members[member_name] = GraphLeader(
                    name=member_name,
                    backstory=member.backstory or "",
                    role=member.role,
                    provider=member.provider,
                    model=member.model,
                    temperature=member.temperature,
                )
        for nei_id in out_counts[member_id]:
            in_counts[nei_id] -= 1
            if in_counts[nei_id] == 0:
                queue.append(nei_id)

    return teams


def convert_sequential_team_to_dict(members: list[Member]) -> Mapping[str, GraphMember]:
    team_dict: dict[str, GraphMember] = {}

    in_counts: defaultdict[int, int] = defaultdict(int)
    out_counts: defaultdict[int, list[int]] = defaultdict(list[int])
    members_lookup: dict[int, Member] = {}
    for member in members:
        assert member.id is not None, "member.id is unexpectedly None"
        if member.source:
            in_counts[member.id] += 1
            out_counts[member.source].append(member.id)
        else:
            in_counts[member.id] = 0
        members_lookup[member.id] = member

    queue: deque[int] = deque()

    for member_id in in_counts:
        if in_counts[member_id] == 0:
            queue.append(member_id)

    while queue:
        member_id = queue.popleft()
        memberModel = members_lookup[member_id]
        tools: list[GraphSkill | GraphUpload]
        tools = [
            GraphSkill(
                name=skill.name,
                managed=skill.managed,
                definition=skill.tool_definition,
            )
            for skill in memberModel.skills
        ]
        tools += [
            GraphUpload(
                name=upload.name,
                description=upload.description,
                owner_id=upload.owner_id,
                upload_id=cast(int, upload.id),
            )
            for upload in memberModel.uploads
            if upload.owner_id is not None
        ]
        graph_member = GraphMember(
            name=memberModel.name,
            backstory=memberModel.backstory or "",
            role=memberModel.role,
            tools=tools,
            provider=memberModel.provider,
            model=memberModel.model,
            temperature=memberModel.temperature,
            interrupt=memberModel.interrupt,
        )
        team_dict[graph_member.name] = graph_member
        for nei_id in out_counts[member_id]:
            in_counts[nei_id] -= 1
            if in_counts[nei_id] == 0:
                queue.append(nei_id)
    return team_dict


def convert_chatbot_chatrag_team_to_dict(
    members: list[Member], workflow_type: str
) -> Mapping[str, GraphMember]:
    team_dict: dict[str, GraphMember] = {}

    if len(members) != 1:
        raise ValueError("Team must contain exactly one member.")

    member = members[0]
    assert member.id is not None, "member.id is unexpectedly None"
    tools: list[GraphSkill | GraphUpload]
    if workflow_type == "ragbot":
        tools = [
            GraphUpload(
                name=upload.name,
                description=upload.description,
                owner_id=upload.owner_id,
                upload_id=cast(int, upload.id),
            )
            for upload in member.uploads
            if upload.owner_id is not None
        ]
    elif workflow_type == "chatbot":
        tools = [
            GraphUpload(
                name=upload.name,
                description=upload.description,
                owner_id=upload.owner_id,
                upload_id=cast(int, upload.id),
            )
            for upload in member.uploads
            if upload.owner_id is not None
        ] + [
            GraphSkill(
                name=skill.name,
                managed=skill.managed,
                definition=skill.tool_definition,
            )
            for skill in member.skills
        ]
    else:
        raise ValueError("Invalid tasktype. Expected 'ragbot' or 'chatbot'.")

    graph_member = GraphMember(
        name=member.name,
        backstory=member.backstory or "",
        role=member.role,
        tools=tools,
        provider=member.provider,
        model=member.model,
        temperature=member.temperature,
        interrupt=member.interrupt,
    )
    team_dict[graph_member.name] = graph_member

    return team_dict


def router(state: GraphTeamState) -> str:
    return state["next"]


def enter_chain(state: GraphTeamState, team: GraphTeam) -> dict[str, Any]:
    """
    Initialise the sub-graph state.
    This makes it so that the states of each graph don't get intermixed.
    """
    task = state["task"]
    results = {
        "main_task": task,
        "team": team,
        "team_members": team.members,
    }
    return results


def exit_chain(state: GraphTeamState) -> dict[str, list[AnyMessage]]:
    """
    Pass the final response back to the top-level graph's state.
    """
    answer = state["history"][-1]
    return {"history": [answer], "all_messages": state["all_messages"]}


def should_continue(state: GraphTeamState) -> str:
    """Determine if graph should go to tool node or not. For tool calling agents."""
    messages: list[AnyMessage] = state["messages"]
    if messages and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
        # TODO: what if multiple tool_calls?
        for tool_call in messages[-1].tool_calls:
            if tool_call["name"] == "ask-human":
                return "call_human"
        else:
            return "call_tools"
    else:
        return "continue"


def create_tools_condition(
    current_member_name: str,
    next_member_name: str,
    tools: list[GraphSkill | GraphUpload],
) -> dict[Hashable, str]:
    """Creates the mapping for conditional edges
    The tool node must be in format: '{current_member_name}_tools'

    Args:
        current_member_name (str): The name of the member that is calling the tool
        next_member_name (str): The name of the next member after the current member processes the tool response. Can be END.
        tools: List of tools that the agent has.
    """
    mapping: dict[Hashable, str] = {
        # Else continue to the next node
        "continue": next_member_name,
    }

    for tool in tools:
        if tool.name == "ask-human":
            mapping["call_human"] = f"{current_member_name}_askHuman_tool"
        else:
            mapping["call_tools"] = f"{current_member_name}_tools"
    return mapping


def askhuman_node(state: GraphTeamState) -> None:
    """Dummy node for ask human tool"""


def create_hierarchical_graph(
    teams: dict[str, GraphTeam],
    leader_name: str,
    checkpointer: BaseCheckpointSaver | None = None,
) -> CompiledGraph:
    """Create the team's graph.

    This function creates a graph representation of the given teams. The graph is represented as a dictionary where each key is a team name,
    and the value is another dictionary containing the team's members, their roles, and tools.

    Args:
        teams (dict[str, dict[str, str | dict[str, Member | Leader]]]): A dictionary where each key is a team leader's name and the value is
            another dictionary containing the team's members.
        leader_name (str): The name of the root leader in the team.

    Returns:
        dict: A dictionary representing the graph of teams.
    """
    build = StateGraph(GraphTeamState)
    # List to store members that require human intervention before tool calling
    interrupt_member_names = (
        []
    )  # List to store members that require human intervention before tool calling
    # Add the start and end node
    build.add_node(
        leader_name,
        RunnableLambda(
            LeaderNode(
                provider=teams[leader_name].provider,
                model=teams[leader_name].model,
                temperature=teams[leader_name].temperature,
            ).delegate  # type: ignore[arg-type]
        ),
    )
    build.add_node(
        "FinalAnswer",
        RunnableLambda(
            SummariserNode(
                provider=teams[leader_name].provider,
                model=teams[leader_name].model,
                temperature=teams[leader_name].temperature,
            ).summarise  # type: ignore[arg-type]
        ),
    )

    members = teams[leader_name].members
    for name, member in members.items():
        if isinstance(member, GraphMember):
            build.add_node(
                name,
                RunnableLambda(
                    WorkerNode(
                        provider=member.provider,
                        model=member.model,
                        temperature=member.temperature,
                    ).work  # type: ignore[arg-type]
                ),
            )
            if member.tools:
                normal_tools: list[BaseTool] = []

                for tool in member.tools:
                    if tool.name == "ask-human":
                        # Handling Ask-Human tool
                        interrupt_member_names.append(f"{name}_askHuman_tool")
                        build.add_node(f"{name}_askHuman_tool", askhuman_node)
                        build.add_edge(f"{name}_askHuman_tool", name)
                    else:
                        normal_tools.append(tool.tool)

                if normal_tools:
                    # Add node for normal tools
                    build.add_node(f"{name}_tools", ToolNode(normal_tools))
                    build.add_edge(f"{name}_tools", name)

                    # Interrupt for normal tools only if member.interrupt is True
                    if member.interrupt:
                        interrupt_member_names.append(f"{name}_tools")

        elif isinstance(member, GraphLeader):
            subgraph = create_hierarchical_graph(
                teams, leader_name=name, checkpointer=checkpointer
            )
            enter = partial(enter_chain, team=teams[name])
            build.add_node(
                name,
                enter | subgraph | exit_chain,
            )
        else:
            continue

        # If member has tools, we create conditional edge to either tool node or back to leader.
        if isinstance(member, GraphMember) and member.tools:
            build.add_conditional_edges(
                name,
                should_continue,
                create_tools_condition(name, leader_name, member.tools),
            )
        else:
            build.add_edge(name, leader_name)

    conditional_mapping: dict[Hashable, str] = {v: v for v in members}
    conditional_mapping["FINISH"] = "FinalAnswer"
    build.add_conditional_edges(leader_name, router, conditional_mapping)

    build.set_entry_point(leader_name)
    build.set_finish_point("FinalAnswer")
    graph = build.compile(
        checkpointer=checkpointer, interrupt_before=interrupt_member_names, debug=True
    )

    return graph


def create_sequential_graph(
    team: Mapping[str, GraphMember], checkpointer: BaseCheckpointSaver
) -> CompiledGraph:
    """
    Creates a sequential graph from a list of team members.

    The graph will have a node for each team member, with edges connecting the nodes in the order the members are provided.
    The first member's node will be set as the entry point, and the last member's node will be connected to the END node.

    Args:
        team (List[Member]): A list of team members.

    Returns:
        CompiledGraph: The compiled graph representing the sequential workflow.
    """
    graph = StateGraph(GraphTeamState)
    # List to store members that require human intervention before it is called
    interrupt_member_names = []
    members = list(team.values())

    for i, member in enumerate(members):
        graph.add_node(
            member.name,
            RunnableLambda(
                SequentialWorkerNode(
                    provider=member.provider,
                    model=member.model,
                    temperature=member.temperature,
                ).work  # type: ignore[arg-type]
            ),
        )
        if member.tools:
            normal_tools: list[BaseTool] = []

            for tool in member.tools:
                if tool.name == "ask-human":
                    # Handling Ask-Human tool
                    interrupt_member_names.append(f"{member.name}_askHuman_tool")
                    graph.add_node(f"{member.name}_askHuman_tool", askhuman_node)
                    graph.add_edge(f"{member.name}_askHuman_tool", member.name)
                else:
                    normal_tools.append(tool.tool)

            if normal_tools:
                # Add node for normal tools
                graph.add_node(f"{member.name}_tools", ToolNode(normal_tools))
                graph.add_edge(f"{member.name}_tools", member.name)

                # Interrupt for normal tools only if member.interrupt is True
                if member.interrupt:
                    interrupt_member_names.append(f"{member.name}_tools")
        if i > 0:
            previous_member = members[i - 1]
            if previous_member.tools:
                graph.add_conditional_edges(
                    previous_member.name,
                    should_continue,
                    create_tools_condition(
                        previous_member.name, member.name, previous_member.tools
                    ),
                )
            else:
                graph.add_edge(previous_member.name, member.name)

    # Handle the final member's tools
    final_member = members[-1]
    if final_member.tools:
        graph.add_conditional_edges(
            final_member.name,
            should_continue,
            create_tools_condition(final_member.name, END, final_member.tools),
        )
    else:
        graph.add_edge(final_member.name, END)

    graph.set_entry_point(members[0].name)
    graph = graph.compile(
        checkpointer=checkpointer,
        interrupt_before=interrupt_member_names,
    )

    return graph


def create_chatbot_ragbot_graph(
    team: Mapping[str, GraphMember], checkpointer: BaseCheckpointSaver
) -> CompiledGraph:
    """
    Creates a simple chatbot graph for a single team member.
    Args:
        team (Mapping[str, GraphMember]): A mapping of a single team member.
    Returns:
        CompiledGraph: The compiled graph representing the sequential workflow.
    """
    if len(team) > 1:
        raise ValueError("Team can only have one GraphMember.")

    member = next(iter(team.values()))
    graph = StateGraph(GraphTeamState)
    # Create a list to store member names that require human intervention before tool calling

    interrupt_member_names = []
    graph.add_node(
        member.name,
        RunnableLambda(
            SequentialWorkerNode(
                provider=member.provider,
                model=member.model,
                temperature=member.temperature,
            ).work  # type: ignore[arg-type]
        ),
    )
    # if member can call tools, then add tool node
    if len(member.tools) >= 1:

        normal_tools: list[BaseTool] = []

        for tool in member.tools:
            if tool.name == "ask-human":
                # Handling Ask-Human tool
                interrupt_member_names.append(f"{member.name}_askHuman_tool")
                graph.add_node(f"{member.name}_askHuman_tool", askhuman_node)
                graph.add_edge(f"{member.name}_askHuman_tool", member.name)
            else:
                normal_tools.append(tool.tool)

        if normal_tools:
            # Add node for normal tools
            graph.add_node(f"{member.name}_tools", ToolNode(normal_tools))
            graph.add_edge(f"{member.name}_tools", member.name)

            # Interrupt for normal tools only if member.interrupt is True
            if member.interrupt:
                interrupt_member_names.append(f"{member.name}_tools")
    if len(member.tools) >= 1:
        graph.add_conditional_edges(
            member.name,
            should_continue,
            create_tools_condition(member.name, END, member.tools),
        )
    else:
        graph.add_edge(member.name, END)
    # graph.add_edge(member.name, END)
    graph.set_entry_point(member.name)
    return graph.compile(
        checkpointer=checkpointer, interrupt_before=interrupt_member_names
    )


def convert_messages_and_tasks_to_dict(data: Any) -> Any:
    if isinstance(data, dict):
        new_data = {}
        for key, value in data.items():
            if key == "messages" or key == "history" or key == "task":
                if isinstance(value, list):
                    new_data[key] = [message.dict() for message in value]
                else:
                    new_data[key] = value
            else:
                new_data[key] = convert_messages_and_tasks_to_dict(value)
        return new_data
    elif isinstance(data, list):
        return [convert_messages_and_tasks_to_dict(item) for item in data]
    else:
        return data


async def generator(
    team: Team,
    members: list[Member],
    messages: list[ChatMessage],
    thread_id: str,
    interrupt: Interrupt | None = None,
) -> AsyncGenerator[Any, Any]:
    """Create the graph and stream responses as JSON."""

    formatted_messages = [
        (
            HumanMessage(
                content=(
                    [
                        {"type": "text", "text": message.content},
                        {"type": "image_url", "image_url": {"url": message.imgdata}},
                    ]
                    if message.imgdata
                    else message.content
                ),
                name="user",
            )
            if message.type == "human"
            else AIMessage(content=message.content)
        )
        for message in messages
    ]

    try:
        async with await AsyncConnection.connect(
            settings.PG_DATABASE_URI,
            **settings.SQLALCHEMY_CONNECTION_KWARGS,
        ) as conn:
            checkpointer = AsyncPostgresSaver(conn=conn)
            if team.workflow == "hierarchical":
                teams = convert_hierarchical_team_to_dict(team, members)
                team_leader = list(teams.keys())[0]
                root = create_hierarchical_graph(
                    teams, leader_name=team_leader, checkpointer=checkpointer
                )
                state: dict[str, Any] | None = {
                    "history": formatted_messages,
                    "messages": [],
                    "team": teams[team_leader],
                    "main_task": formatted_messages,
                    "all_messages": formatted_messages,
                }
            elif team.workflow == "sequential":

                member_dict = convert_sequential_team_to_dict(members)
                root = create_sequential_graph(member_dict, checkpointer)
                first_member = list(member_dict.values())[0]
                state = {
                    "history": formatted_messages,
                    "team": GraphTeam(
                        name=first_member.name,
                        role=first_member.role,
                        backstory=first_member.backstory,
                        members=member_dict,  # type: ignore[arg-type]
                        provider=first_member.provider,
                        model=first_member.model,
                        temperature=first_member.temperature,
                    ),
                    "messages": [],
                    "next": first_member.name,
                    "all_messages": formatted_messages,
                }

            elif team.workflow in ["ragbot"]:
                member_dict = convert_chatbot_chatrag_team_to_dict(
                    members, workflow_type=team.workflow
                )
                root = create_chatbot_ragbot_graph(member_dict, checkpointer)
                first_member = list(member_dict.values())[0]
                state = {
                    "history": formatted_messages,
                    "team": GraphTeam(
                        name=first_member.name,
                        role=first_member.role,
                        backstory=first_member.backstory,
                        members=member_dict,  # type: ignore[arg-type]
                        provider=first_member.provider,
                        model=first_member.model,
                        temperature=first_member.temperature,
                    ),
                    "messages": [],
                    "next": first_member.name,
                    "all_messages": formatted_messages,
                }
            elif team.workflow in ["chatbot"]:
                member_dict = convert_chatbot_chatrag_team_to_dict(
                    members, workflow_type=team.workflow
                )

                root = create_chatbot_ragbot_graph(member_dict, checkpointer)

                first_member = list(member_dict.values())[0]
                state = {
                    "history": formatted_messages,
                    "team": GraphTeam(
                        name=first_member.name,
                        role=first_member.role,
                        backstory=first_member.backstory,
                        members=member_dict,  # type: ignore[arg-type]
                        provider=first_member.provider,
                        model=first_member.model,
                        temperature=first_member.temperature,
                    ),
                    "messages": [],
                    "next": first_member.name,
                    "all_messages": formatted_messages,
                }
            elif team.workflow in ["workflow"]:

                graph_config = team.graphs[0].config

                root = initialize_graph(
                    graph_config, checkpointer, save_graph_img=False
                )

                state = {
                    "history": formatted_messages,
                    "messages": [],
                    "all_messages": formatted_messages,
                }
            else:
                raise ValueError("Unsupported graph type ")

            config: RunnableConfig = {
                "configurable": {"thread_id": thread_id},
                "recursion_limit": settings.RECURSION_LIMIT,
            }

            # Handle interrupt logic by orriding state
            if interrupt and interrupt.interaction_type is None:
                if interrupt.decision == InterruptDecision.APPROVED:
                    state = None
                elif interrupt.decision == InterruptDecision.REJECTED:
                    current_values = await root.aget_state(config)
                    messages = current_values.values["messages"]
                    if messages and isinstance(messages[-1], AIMessage):
                        tool_calls = messages[-1].tool_calls
                        state = {
                            "messages": [
                                ToolMessage(
                                    tool_call_id=tool_call["id"],
                                    content="Rejected by user. Continue assisting.",
                                )
                                for tool_call in tool_calls
                            ]
                        }
                        if interrupt.tool_message:
                            state["messages"].append(
                                HumanMessage(
                                    content=interrupt.tool_message,
                                    name="user",
                                    id=str(uuid4()),
                                )
                            )
                elif interrupt.decision == InterruptDecision.REPLIED:
                    current_values = await root.aget_state(config)
                    messages = current_values.values["messages"]
                    if (
                        messages
                        and isinstance(messages[-1], AIMessage)
                        and interrupt.tool_message
                    ):
                        tool_calls = messages[-1].tool_calls
                        state = {
                            "messages": [
                                ToolMessage(
                                    tool_call_id=tool_call["id"],
                                    content=interrupt.tool_message,
                                    name="ask-human",
                                )
                                for tool_call in tool_calls
                                if tool_call["name"] == "ask-human"
                            ]
                        }
            elif interrupt and interrupt.interaction_type is not None:
                # 添加新的工具审查相关的中断处理
                if interrupt.interaction_type == "tool_review":
                    if interrupt.decision == InterruptDecision.APPROVED:
                        # 批准工具调用,继续执行

                        state = Command(resume={"action": "approved"})

                    elif interrupt.decision == InterruptDecision.REJECTED:
                        # 拒绝工具调用,添加拒绝消息

                        reject_message = (
                            interrupt.tool_message if interrupt.tool_message else None
                        )
                        state = Command(
                            resume={"action": "rejected", "data": reject_message}
                        )

                    elif interrupt.decision == InterruptDecision.UPDATE:
                        # 更新工具调用参数

                        state = Command(
                            resume={"action": "update", "data": interrupt.tool_message}
                        )

                elif interrupt.interaction_type == "output_review":
                    # 处理输出审查
                    if interrupt.decision == InterruptDecision.APPROVED:
                        # 批准输出,继续执行
                        state = Command(resume={"action": "approved"})
                    elif interrupt.decision == InterruptDecision.REVIEW:
                        # 需要修改输出,添加反馈
                        state = Command(
                            resume={"action": "review", "data": interrupt.tool_message}
                        )
                    elif interrupt.decision == InterruptDecision.EDIT:
                        # 直接编辑输出内容
                        state = Command(
                            resume={"action": "edit", "data": interrupt.tool_message}
                        )
                    else:
                        raise ValueError(
                            f"Unsupported decision for output review: {interrupt.decision}"
                        )

                elif interrupt.interaction_type == "context_input":
                    # 处理上下文输入,添加用户提供的额外信息
                    if interrupt.decision == InterruptDecision.CONTINUE:
                        state = Command(
                            resume={
                                "action": "continue",
                                "data": interrupt.tool_message,
                            }
                        )
                    else:
                        raise ValueError(
                            f"Unsupported decision for context input: {interrupt.decision}"
                        )

                else:
                    raise ValueError(
                        f"Unsupported interrupt type: {interrupt.interaction_type}"
                    )
            async for event in root.astream_events(state, version="v2", config=config):
                response = event_to_response(event)
                if response:
                    formatted_output = f"data: {response.model_dump_json()}\n\n"
                    yield formatted_output
            snapshot = await root.aget_state(config)

            if snapshot.next:
                try:
                    message = snapshot.values["messages"][-1]
                except Exception:
                    message = snapshot.values["all_messages"][-1]

                # 非workflow类型的处理
                if team.workflow != "workflow":
                    # Determine if should return default or askhuman interrupt based on whether AskHuman tool was called.
                    if not isinstance(message, AIMessage):
                        return
                    for tool_call in message.tool_calls:
                        if tool_call["name"] == "ask-human":
                            response = ChatResponse(
                                type="interrupt",
                                name="human",
                                tool_calls=message.tool_calls,
                                id=str(uuid4()),
                            )
                            break
                    else:
                        response = ChatResponse(
                            type="interrupt",
                            name="interrupt",
                            tool_calls=message.tool_calls,
                            id=str(uuid4()),
                        )
                # workflow类型的处理
                else:
                    next_node = snapshot.next[0]
                    for node in graph_config["nodes"]:
                        if node["id"] == next_node:
                            interrupt_name = node["data"]["interaction_type"]
                            break
                    if interrupt_name == "context_input":
                        response = ChatResponse(
                            type="interrupt",
                            name=interrupt_name,
                            content=f"LLM的输出如下：\n\n`{message.content}`\n\n请输入您的补充信息",
                            id=str(uuid4()),
                        )
                    elif interrupt_name == "tool_review":
                        response = ChatResponse(
                            type="interrupt",
                            name=interrupt_name,
                            tool_calls=message.tool_calls,
                            id=str(uuid4()),
                        )
                    elif interrupt_name == "output_review":
                        response = ChatResponse(
                            type="interrupt",
                            name=interrupt_name,
                            content=f"LLM的输出如下：\n\n`{message.content}`\n\n请批准，或者输入您的审批意见",
                            id=str(uuid4()),
                        )

                formatted_output = f"data: {response.model_dump_json()}\n\n"
                yield formatted_output
    except Exception as e:
        response = ChatResponse(
            type="error", content=str(e), id=str(uuid4()), name="error"
        )
        yield f"data: {response.model_dump_json()}\n\n"
        await asyncio.sleep(0.1)  # Add a small delay to ensure the message is sent
        raise e
