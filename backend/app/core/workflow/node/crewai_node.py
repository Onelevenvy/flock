from typing import Any, Dict, List, Optional
from langchain_core.runnables import RunnableConfig
from .state import ReturnTeamState, TeamState, update_node_outputs
from langchain_core.messages import AIMessage
from crewai import Agent, Crew, Task, Process, LLM
from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.tools.tool_manager import managed_tools


class CrewAINode:
    DEFAULT_MANAGER_BACKSTORY = """You are a seasoned manager with a knack for getting the best out of your team.
You are also known for your ability to delegate work to the right people, and to ask the right questions to get the best out of your team.
Even though you don't perform tasks by yourself, you have a lot of experience in the field, which allows you to properly evaluate the work of your team members."""

    def __init__(
        self,
        node_id: str,
        provider: str,
        model: str,
        agents_config: List[Dict[str, Any]],
        tasks_config: List[Dict[str, Any]],
        process_type: str = "sequential",
        openai_api_key: str = "",
        openai_api_base: str = "",
        manager_config: Dict[str, Any] = {},
        config: dict[str, Any] = {},
    ):
        self.node_id = node_id
        self.agents_config = agents_config
        self.tasks_config = tasks_config
        self.process_type = process_type
        self.config = config

        # 初始化 LLM
        self.llm = model_provider_manager.init_crewai_model(
            provider_name=provider,
            model=model,
            openai_api_key=openai_api_key,
            openai_api_base=openai_api_base,
        )

        # Initialize manager agent for hierarchical process
        self.manager_agent = None
        if process_type == "hierarchical":
            manager_agent_config = manager_config.get(
                "agent",
                {
                    "role": "Crew Manager",
                    "goal": "Manage the team to complete the task in the best way possible.",
                    "backstory": self.DEFAULT_MANAGER_BACKSTORY,
                    "allow_delegation": True,
                },
            )

            self.manager_agent = Agent(
                role=manager_agent_config["role"],
                goal=manager_agent_config["goal"],
                backstory=manager_agent_config["backstory"],
                allow_delegation=True,
                verbose=True,
                llm=self.llm,
            )

    def _get_tool_instance(self, tool_name: str):
        """Get tool instance by name"""
        for tool_id, tool_info in managed_tools.items():
            if tool_info.display_name == tool_name:
                return tool_info.tool
        return None

    def _create_agent(self, agent_config: Dict[str, Any]) -> Agent:
        """Create an agent from configuration"""
        tools = []
        # 从配置中获取工具列表
        for tool_name in agent_config.get("tools", []):
            tool = self._get_tool_instance(tool_name)
            if tool:
                tools.append(tool)

        return Agent(
            role=agent_config["role"],
            goal=agent_config["goal"],
            backstory=agent_config["backstory"],
            allow_delegation=agent_config.get("allow_delegation", False),
            tools=tools,
            verbose=True,
            llm=self.llm,
        )

    def _create_task(
        self, task_config: Dict[str, Any], agents: Dict[str, Agent]
    ) -> Task:
        """Create a task from configuration"""
        return Task(
            description=task_config["description"],
            agent=agents[task_config["agent_id"]],
            expected_output=task_config.get("expected_output"),
            output_json=task_config.get("output_json"),
            context=task_config.get("context", []),
            llm=self.llm,
        )

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # Create agents
        agents = {
            agent_config["id"]: self._create_agent(agent_config)
            for agent_config in self.agents_config
        }

        # Create tasks
        tasks = [
            self._create_task(task_config, agents) for task_config in self.tasks_config
        ]

        # Create and run crew
        crew = Crew(
            agents=list(agents.values()),
            tasks=tasks,
            process=(
                Process.sequential
                if self.process_type == "sequential"
                else Process.hierarchical
            ),
            verbose=True,
            manager_agent=(
                self.manager_agent if self.process_type == "hierarchical" else None
            ),
        )

        # Run the crew
        result = crew.kickoff()
        raw_result_str = result.raw
        # Update node_outputs
        new_output = {self.node_id: {"response": raw_result_str}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        # Create AI message from result
        crewai_res_message = AIMessage(content=str(raw_result_str))

        return_state: ReturnTeamState = {
            "history": state.get("history", []) + [crewai_res_message],
            "messages": [crewai_res_message],
            "all_messages": state.get("all_messages", []) + [crewai_res_message],
            "node_outputs": state["node_outputs"],
        }
        return return_state
