import json
import logging
import uuid
from textwrap import dedent

from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableConfig

from ....state import (ReturnWorkflowState, WorkflowState, parse_variables,
                       update_node_outputs)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CodeTemplate:
    """代码模板管理类"""

    _code_placeholder = "{code}"
    _inputs_placeholder = "{inputs}"

    @classmethod
    def get_runner_script(cls) -> str:
        """创建标准化的执行脚本模板"""
        runner_script = dedent(
            f"""
            # 用户定义的函数
            {cls._code_placeholder}

            import json, ast

            def find_function_name(code):
                tree = ast.parse(code)
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        return node.name
                return None

            # 分析代码获取函数名
            code = '''{cls._code_placeholder}'''
            function_name = find_function_name(code)

            if not function_name:
                raise Exception("No function found in the code")

            # 执行代码
            exec(code)

            # 执行函数并获取结果
            result = eval(f"{{function_name}}()")

            # 转换结果为JSON并打印
            output_json = json.dumps(result, indent=4)
            print(f'<<RESULT>>{{output_json}}<<RESULT>>')
            """
        )
        return runner_script

    @classmethod
    def create_execution_script(cls, code: str, inputs: dict = None) -> str:
        """创建完整的执行脚本"""
        runner_script = cls.get_runner_script()
        # 替换占位符
        script = runner_script.replace(cls._code_placeholder, code)
        if inputs:
            inputs_json = json.dumps(inputs)
            script = script.replace(cls._inputs_placeholder, inputs_json)
        return script


class CodeExecutor:
    """Code execution engine using PyodideSandbox"""

    _instance = None
    _sandbox = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(CodeExecutor, cls).__new__(cls)
        return cls._instance

    def __init__(self, timeout: int = 30, memory_limit: str = "256m", **kwargs):
        if not hasattr(self, "initialized"):
            self.timeout = timeout
            try:
                from langchain_sandbox import PyodideSandboxTool

                self._sandbox = PyodideSandboxTool(
                    stateful=False,  # 不需要状态持久化
                    allow_net=True,  # 允许网络访问以安装依赖
                )
            except ImportError:
                self._sandbox = None
            self.initialized = True

    async def execute(self, code: str, libraries: list[str]) -> str:
        """Execute code in PyodideSandbox"""
        print(f"\nStarting code execution with {len(libraries)} libraries")
        if libraries:
            print(f"Required libraries: {', '.join(libraries)}")

        try:
            if self._sandbox is None:
                return "Please install Deno first following https://docs.deno.com/runtime/getting_started/installation/ then install langchain-sandbox"

            # 使用模板创建执行脚本
            runner_script = CodeTemplate.create_execution_script(code)

            # 执行代码
            result = await self._sandbox.ainvoke(runner_script)

            # 解析输出中的结果
            import re

            result_match = re.search(r"<<RESULT>>(.+?)<<RESULT>>", result, re.DOTALL)
            if result_match:
                result_json = result_match.group(1)
                try:
                    result = json.loads(result_json.strip())
                    return result
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    return result_json.strip()

            return result

        except Exception as e:
            error_msg = f"Execution error: {str(e)}"
            print(f"\nError: {error_msg}")
            return error_msg


class CodeNode:
    """Node for executing Python code in workflow"""

    def __init__(
        self,
        node_id: str,
        code: str,
        libraries: list[str] | None = None,
        timeout: int = 30,
        memory_limit: str = "256m",
    ):
        self.node_id = node_id
        self.code = code
        self.libraries = libraries or []
        self.executor = CodeExecutor(timeout=timeout, memory_limit=memory_limit)

    async def work(
        self, state: WorkflowState, config: RunnableConfig
    ) -> ReturnWorkflowState:
        """Execute code and update state"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        try:
            # Parse variables in code
            parsed_code = parse_variables(
                self.code, state["node_outputs"], is_code=True
            )

            # Execute code
            code_execution_result = await self.executor.execute(
                parsed_code, self.libraries
            )

            if isinstance(code_execution_result, str):
                # If code_result is a string, return it as it is
                code_result = code_execution_result
            elif isinstance(code_execution_result, dict):
                if "res" in code_execution_result:
                    # If the dictionary contains the "result" key, return its value
                    code_result = code_execution_result["res"]
                else:
                    code_result = "Error: The Code Execution Result must return a dictionary with the 'res' key."
            else:
                code_result = "Error: Invalid code return type, please return a dictionary with the 'res' key."

            result = ToolMessage(
                content=code_result,
                name="CodeExecutor",
                tool_call_id=str(uuid.uuid4()),
            )

            # Update node outputs
            new_output = {self.node_id: {"response": result.content}}
            state["node_outputs"] = update_node_outputs(
                state["node_outputs"], new_output
            )

            return_state: ReturnWorkflowState = {
                "history": state.get("history", []) + [result],
                "messages": [result],
                "all_messages": state.get("all_messages", []) + [result],
                "node_outputs": state["node_outputs"],
            }
            return return_state

        except Exception as e:
            error_message = f"Code execution failed: {str(e)}"

            result = ToolMessage(
                content=error_message,
                name="CodeExecutor",
                tool_call_id=str(uuid.uuid4()),
            )

            new_output = {self.node_id: {"response": result.content}}
            state["node_outputs"] = update_node_outputs(
                state["node_outputs"], new_output
            )
            return_state: ReturnWorkflowState = {
                "history": state.get("history", []) + [result],
                "messages": [result],
                "all_messages": state.get("all_messages", []) + [result],
                "node_outputs": state["node_outputs"],
            }
            return return_state
