from typing import Any, Dict, List

from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.prebuilt.chat_agent_executor import AgentState

from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    format_messages,
    parse_variables,
    update_node_outputs,
)
from app.core.workflow.utils.db_utils import get_model_info
from app.core.workflow.utils.tools_utils import get_retrieval_tool, get_tool

from typing import Any


from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder



class AgentNode:
    """Agent Node that combines LLM with tools and knowledge bases"""

    def __init__(
        self,
        node_id: str,
        model_name: str,
        temperature: float,
        system_message: str = None,
        user_message: str = None,
        tools: List[str] = None,
        retrieval_tools: List[Dict[str, Any]] = None,
        agent_name: str = None,
    ):
        self.node_id = node_id
        self.system_message = system_message 
        self.user_message = user_message
        self.agent_name = agent_name or node_id
        self.model_info = get_model_info(model_name)
        self.system_prompt = system_message
        self.user_prompt = user_message
        # 准备工具列表
        self.tools_list = []
        
        # 添加常规工具
        if tools:
            for tool_name in tools:
                tool = get_tool(tool_name)
                if tool:
                    self.tools_list.append(tool)
        
        # 添加知识库工具
        if retrieval_tools:
            for kb_tool in retrieval_tools:
                if isinstance(kb_tool, dict):
                    retrieval_tool = get_retrieval_tool(
                        kb_tool["name"],
                        kb_tool.get("description", ""),
                        kb_tool.get("usr_id", 0),
                        kb_tool.get("kb_id", 0),
                    )
                    if retrieval_tool:
                        self.tools_list.append(retrieval_tool)
                elif isinstance(kb_tool, str):
                    retrieval_tool = get_retrieval_tool(
                        kb_tool,
                        f"Search in knowledge base {kb_tool}",
                        0,
                        0,
                    )
                    if retrieval_tool:
                        self.tools_list.append(retrieval_tool)
        
        # 初始化模型
        try:
            # 创建模型配置
            self.model_config = {
                "provider_name": self.model_info["provider_name"],
                "model": self.model_info["ai_model_name"],
                "temperature": temperature,
                "api_key": self.model_info["api_key"],
                "base_url": self.model_info["base_url"],
            }
            
            # 初始化模型
            self.llm = model_provider_manager.init_model(**self.model_config)
            
           
            
            

        except ValueError:
            raise ValueError(f"Model {model_name} is not supported as a chat model.")

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:
        """执行Agent节点的工作"""

        if "node_outputs" not in state:
            state["node_outputs"] = {}
        
        history = state.get("history", [])
        messages = state.get("messages", [])
        all_messages = state.get("all_messages", [])
        
        if self.system_prompt:
            # First parse variables, then escape any remaining curly braces
            parsed_system_prompt = (
                parse_variables(self.system_prompt, state["node_outputs"])
                .replace("{", "{{")
                .replace("}", "}}")
            )

            llm_node_prompts = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "Perform the task given to you.\n"
                        "If you are unable to perform the task, that's OK, you can ask human for help, or just say that you are unable to perform the task."
                        "Execute what you can to make progress. "
                        "And your role is:" + parsed_system_prompt + "\n"
                        "And your name is:"
                        + self.agent_name
                        + "\n"
                        + "please remember your name\n"
                        "Stay true to your role and use your tools if necessary.\n\n",
                    ),
                    (
                        "human",
                        "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
                    ),
                    MessagesPlaceholder(variable_name="messages"),
                ]
            )

        else:
            llm_node_prompts = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        (
                            "Perform the task given to you.\n"
                            "If you are unable to perform the task, that's OK, you can ask human for help, or just say that you are unable to perform the task."
                            "Execute what you can to make progress. "
                            "Stay true to your role and use your tools if necessary.\n\n"
                        ),
                    ),
                    (
                        "human",
                        "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
                    ),
                    MessagesPlaceholder(variable_name="messages"),
                ]
            )

        history = state.get("history", [])
        messages = state.get("messages", [])
        all_messages = state.get("all_messages", [])
        prompt = llm_node_prompts.partial(history_string=format_messages(history))
       
        
        # 准备Agent的输入状态
        if self.user_prompt:
            parsed_user_prompt = (
                parse_variables(self.user_prompt, state["node_outputs"])
                .replace("{", "{{")
                .replace("}", "}}")
            )
            agent_input = {
                "messages": [{"role": "user", "content": parsed_user_prompt}]}
        else:
            agent_input = {
                "messages": [{"role": "user", "content": all_messages[-1].content}]}  # 最后一条用户类型的消息
            
        # 创建React Agent
        self.agent = create_react_agent(
                model=self.llm,
                tools=self.tools_list,
                messages_modifier=prompt,
            )
        # 调用Agent
        agent_result = await self.agent.ainvoke(agent_input)
        
        # 获取最终回复
        messages = agent_result["messages"]
        # 从后往前找第一个不带工具调用的AI消息
        for msg in reversed(messages):
            if msg.type == "ai" and not hasattr(msg, "tool_calls"):
                result = msg
                break
        else:
            # 如果没有找到合适的AIMessage，使用最后一个消息
            result = messages[-1]
        
        # 更新 node_outputs
        new_output = {self.node_id: {"response": result.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)
        
        return_state: ReturnWorkflowTeamState = {
            "history": history + [result],
            "messages": [result] if hasattr(result, "tool_calls") and result.tool_calls else [],
            "all_messages": messages + [result],
            "node_outputs": state["node_outputs"],
        }
        
        return return_state 