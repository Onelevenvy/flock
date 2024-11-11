from crewai import Agent, Crew, Process, Task, LLM
from crewai.project import CrewBase, agent, crew, task

# Uncomment the following line to use an example of a custom tool
# from latest_ai_development.tools.custom_tool import MyCustomTool

# Check our tools documentations for more information on how to use them
# from crewai_tools import SerperDevTool


@CrewBase
class LatestAiDevelopmentCrew:
    """LatestAiDevelopment crew"""

    process: str = "sequential"
    # manager_llm: str = LLM(
    #     model="openai/gpt-4o-mini", base_url="https://fake.url", api_key="fake_key"
    # )
    # llm: str = LLM(
    #     model="openai/gpt-4o-mini", base_url="https://fake.url", api_key="fake_key"
    # )

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["researcher"],
            # tools=[MyCustomTool()], # Example of custom tool, loaded on the beginning of file
            verbose=True,
            llm=self.llm,
        )

    @agent
    def reporting_analyst(self) -> Agent:
        return Agent(config=self.agents_config["reporting_analyst"], verbose=True)

    @task
    def research_task(self) -> Task:
        return Task(
            config=self.tasks_config["research_task"],
            llm=self.llm,
        )

    @task
    def reporting_task(self) -> Task:
        return Task(config=self.tasks_config["reporting_task"], output_file="report.md")

    @crew
    def crew(self) -> Crew:
        """Creates the LatestAiDevelopment crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=(
                Process.sequential
                if self.process == "sequential"
                else Process.hierarchical
            ),
            verbose=True,
            manager_llm=self.manager_llm if self.process == "hierarchical" else None,
            manager_agent=self.manager_agent if self.process == "hierarchical" else None,
        )
