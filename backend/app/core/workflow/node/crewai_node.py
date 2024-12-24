from typing import Any, Dict, List
from app.core.workflow.utils.db_utils import get_model_info
from langchain_core.runnables import RunnableConfig
from .state import ReturnTeamState, TeamState, update_node_outputs, parse_variables
from langchain_core.messages import AIMessage
from crewai import Agent, Crew, Task, Process
from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.tools.tool_manager import managed_tools


class CrewAINode:
    DEFAULT_MANAGER_BACKSTORY = """You are a seasoned manager with a knack for getting the best out of your team.
You are also known for your ability to delegate work to the right people, and to ask the right questions to get the best out of your team.
Even though you don't perform tasks by yourself, you have a lot of experience in the field, which allows you to properly evaluate the work of your team members."""

    def __init__(
        self,
        node_id: str,
        model_name: str,
        agents_config: List[Dict[str, Any]],
        tasks_config: List[Dict[str, Any]],
        process_type: str = "sequential",
        manager_config: Dict[str, Any] = {},
        config: dict[str, Any] = {},
    ):
        self.node_id = node_id
        self.agents_config = agents_config
        self.tasks_config = tasks_config
        self.process_type = process_type
        self.config = config

        self.model_info = get_model_info(model_name)
        # 初始化 LLM
        self.llm = model_provider_manager.init_crewai_model(
            provider_name=self.model_info["provider_name"],
            model=self.model_info["ai_model_name"],
            api_key=self.model_info["api_key"],
            base_url=self.model_info["base_url"],
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

            # Parse variables in manager config
            if "role" in manager_agent_config:
                manager_agent_config["role"] = parse_variables(
                    manager_agent_config["role"], {}
                )
            if "goal" in manager_agent_config:
                manager_agent_config["goal"] = parse_variables(
                    manager_agent_config["goal"], {}
                )
            if "backstory" in manager_agent_config:
                manager_agent_config["backstory"] = parse_variables(
                    manager_agent_config["backstory"], {}
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

    def _create_agent(self, agent_config: Dict[str, Any], state: TeamState) -> Agent:
        """Create an agent from configuration with variable parsing"""
        tools = []
        # 从配置中获取工具列表
        for tool_name in agent_config.get("tools", []):
            tool = self._get_tool_instance(tool_name)
            if tool:
                tools.append(tool)

        # Parse variables in agent configuration
        role = parse_variables(agent_config["role"], state["node_outputs"])
        goal = parse_variables(agent_config["goal"], state["node_outputs"])
        backstory = parse_variables(agent_config["backstory"], state["node_outputs"])

        return Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            allow_delegation=agent_config.get("allow_delegation", False),
            tools=tools,
            verbose=True,
            llm=self.llm,
        )

    def _create_task(
        self, task_config: Dict[str, Any], agents: Dict[str, Agent], state: TeamState
    ) -> Task:
        """Create a task from configuration with variable parsing"""
        # Parse variables in task configuration
        description = parse_variables(task_config["description"], state["node_outputs"])

        # 确保 expected_output 始终是字符串
        expected_output = ""
        if task_config.get("expected_output"):
            expected_output = parse_variables(
                task_config["expected_output"], state["node_outputs"]
            )

        # Parse context variables if they exist
        context = []
        if task_config.get("context"):
            context = [
                parse_variables(ctx, state["node_outputs"])
                for ctx in task_config["context"]
            ]

        return Task(
            description=description,
            agent=agents[task_config["agent_id"]],
            expected_output=expected_output,  # 现在这里一定是字符串
            output_json=task_config.get("output_json"),
            context=context if context else None,
            llm=self.llm,
        )

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # Create agents with variable parsing
        agents = {
            agent_config["id"]: self._create_agent(agent_config, state)
            for agent_config in self.agents_config
        }

        # Create tasks with variable parsing
        tasks = [
            self._create_task(task_config, agents, state)
            for task_config in self.tasks_config
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
