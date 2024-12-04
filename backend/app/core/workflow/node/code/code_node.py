import json
from typing import Any, Dict, List, Optional
import uuid
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
import docker
from ..state import ReturnTeamState, TeamState, parse_variables, update_node_outputs
import threading
import queue
import time
import logging
import base64
from textwrap import dedent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ContainerPool:
    """管理Docker容器池"""

    def __init__(self, image_tag: str, pool_size: int = 3, memory_limit: str = "256m"):
        self.image_tag = image_tag
        self.pool_size = pool_size
        self.memory_limit = memory_limit
        self.available_containers = queue.Queue()
        self.active_containers = {}  # 改用字典来跟踪容器
        self.client = docker.from_env()
        self.lock = threading.Lock()
        self._initialize_pool()

    def _initialize_pool(self):
        """初始化容器池"""
        container = self._create_container()
        self.available_containers.put(container)

    def _create_container(self):
        """创建新的容器"""
        container_name = f"code-interpreter-worker-{len(self.active_containers)}"
        try:
            logger.info(f"Creating container: {container_name}")
            # 先尝试删除同名容器
            try:
                old_container = self.client.containers.get(container_name)
                old_container.remove(force=True)
                logger.info(f"Removed old container: {container_name}")
            except docker.errors.NotFound:
                pass

            # 创建新容器
            container = self.client.containers.run(
                self.image_tag,
                detach=True,
                tty=True,
                working_dir="/workspace",
                remove=True,  # 容器停止时自动删除
                stdin_open=True,
                network="docker_default",
                volumes={"app-code-workspace": {"bind": "/workspace", "mode": "rw"}},
                mem_limit=self.memory_limit,
                security_opt=["no-new-privileges:true"],
                cap_drop=["ALL"],
                name=container_name,
                command=[
                    "/bin/bash",
                    "/opt/code-interpreter/scripts/entrypoint.sh",
                ],  # 显式指定启动命令
            )

            # 等待容器完全启动
            time.sleep(0.5)
            container.reload()

            self.active_containers[container.id] = container
            logger.info(f"Created container: {container_name}")
            return container

        except Exception as e:
            logger.error(f"Error creating container: {e}")
            raise

    def get_container(self):
        """获取一个可用的容器"""
        with self.lock:
            try:
                container = self.available_containers.get_nowait()
                # 检查容器是否还在运行
                try:
                    container.reload()
                    return container
                except:
                    # 使用 pop 而不是 discard，因为是字典
                    self.active_containers.pop(container.id, None)
                    return self._create_container()
            except queue.Empty:
                if len(self.active_containers) < self.pool_size:
                    return self._create_container()
                else:
                    # 等待可用容器
                    return self.available_containers.get(timeout=5)

    def return_container(self, container):
        """归还容器到池中"""
        with self.lock:
            try:
                container.reload()  # 检查容器状态
                container.exec_run("rm -rf /workspace/*")  # 清理工作目录
                self.available_containers.put(container)
            except:
                # 使用 pop 而不是 discard
                self.active_containers.pop(container.id, None)
                try:
                    container.remove(force=True)
                except:
                    pass

    def cleanup(self):
        """清理所有容器"""
        with self.lock:
            # 清理活动容器
            for container_id, container in list(self.active_containers.items()):
                try:
                    logger.info(f"Removing container: {container.name}")
                    container.remove(force=True)
                except Exception as e:
                    logger.error(f"Error removing container: {e}")
                finally:
                    self.active_containers.pop(container_id, None)

            # 清理所有 code-interpreter-worker 容器
            try:
                containers = self.client.containers.list(
                    all=True, filters={"name": "code-interpreter-worker"}
                )
                for container in containers:
                    try:
                        container.remove(force=True)
                        logger.info(f"Removed worker container: {container.name}")
                    except Exception as e:
                        logger.error(f"Error removing worker container: {e}")
            except Exception as e:
                logger.error(f"Error listing containers: {e}")

    def __del__(self):
        """确保在对象被销毁时清理所有容器"""
        self.cleanup()


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
    """Code execution engine using Docker with container pooling"""

    _instance = None
    _pool = None

    # Python 内置库，不需要安装
    BUILTIN_LIBRARIES = {
        "os",
        "sys",
        "glob",
        "json",
        "time",
        "datetime",
        "random",
        "math",
        "re",
        "collections",
        "itertools",
        "functools",
        "pathlib",
        "base64",
        "hashlib",
        "uuid",
        # ... 其他内置库
    }

    # 预装的第三方库
    PREINSTALLED_LIBRARIES = {
        "numpy",
        "pandas",
        "requests",
        "python-dateutil",
        "matplotlib",
        # ... 其他预装的第三方库
    }

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(CodeExecutor, cls).__new__(cls)
        return cls._instance

    def __init__(
        self,
        timeout: int = 30,
        memory_limit: str = "256m",
        image_tag: str = "code-interpreter:latest",
        pool_size: int = 3,
    ):
        if not hasattr(self, "initialized"):
            self.timeout = timeout
            self.memory_limit = memory_limit
            self.image_tag = image_tag
            self.client = docker.from_env()
            self._verify_docker_image()
            self._pool = ContainerPool(
                image_tag=image_tag, pool_size=pool_size, memory_limit=memory_limit
            )
            self.initialized = True

    def _verify_docker_image(self) -> None:
        """Verify if Docker image exists, build if not"""
        try:
            self.client.images.get(self.image_tag)
        except docker.errors.ImageNotFound:
            # 更新Dockerfile路径
            dockerfile_path = "./docker/code-interpreter"
            self.client.images.build(path=dockerfile_path, tag=self.image_tag, rm=True)

    def _install_libraries(
        self, container: docker.models.containers.Container, libraries: List[str]
    ) -> None:
        """Install required libraries in container"""
        # 过滤掉内置库和预装库
        libraries_to_install = [
            lib
            for lib in libraries
            if lib.lower() not in self.PREINSTALLED_LIBRARIES
            and lib.lower() not in self.BUILTIN_LIBRARIES
        ]

        if libraries_to_install:
            print(f"Installing libraries: {', '.join(libraries_to_install)}")
            for library in libraries_to_install:
                container.exec_run(f"pip install --user {library}")
        else:
            print("All required libraries are pre-installed or built-in")

    def execute(self, code: str, libraries: List[str]) -> str:
        """Execute code in Docker container with safety measures"""
        print(f"\nStarting code execution with {len(libraries)} libraries")
        if libraries:
            print(f"Required libraries: {', '.join(libraries)}")

        container = self._pool.get_container()
        print(f"Using container: {container.name}")

        try:
            # Install required libraries
            self._install_libraries(container, libraries)
            print("Libraries installed successfully")

            # 使用模板创建执行脚本
            runner_script = CodeTemplate.create_execution_script(code)

            # 只需要一次编码
            code_base64 = base64.b64encode(runner_script.encode("utf-8")).decode(
                "utf-8"
            )
            decode_and_exec = f'''python3 -c "import base64; exec(base64.b64decode('{code_base64}').decode('utf-8'))"'''

            # 执行代码
            exec_result = container.exec_run(
                decode_and_exec, tty=True, environment={"PYTHONUNBUFFERED": "1"}
            )

            if exec_result.exit_code != 0:
                error_msg = (
                    f"Error executing code: {exec_result.output.decode('utf-8')}"
                )
                print(f"\nError: {error_msg}")
                return error_msg

            result = exec_result.output.decode("utf-8")

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

            print("\nCode execution result:")
            print(result)
            return result

        except Exception as e:
            error_msg = f"Execution error: {str(e)}"
            print(f"\nError: {error_msg}")
            return error_msg

        finally:
            print("Returning container to pool")
            self._pool.return_container(container)

    def cleanup(self):
        """清理所有资源"""
        if self._pool:
            self._pool.cleanup()

    def __del__(self):
        """确保在对象被销毁时清理资源"""
        self.cleanup()


class CodeNode:
    """Node for executing Python code in workflow"""

    def __init__(
        self,
        node_id: str,
        code: str,
        libraries: Optional[List[str]] = None,
        timeout: int = 30,
        memory_limit: str = "256m",
    ):
        self.node_id = node_id
        self.code = code
        self.libraries = libraries or []
        self.executor = CodeExecutor(timeout=timeout, memory_limit=memory_limit)

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        """Execute code and update state"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        try:
            # Parse variables in code
            parsed_code = parse_variables(self.code, state["node_outputs"])

            # Execute code
            code_result = self.executor.execute(parsed_code, self.libraries)

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

            return_state: ReturnTeamState = {
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
            return_state: ReturnTeamState = {
                "history": state.get("history", []) + [result],
                "messages": [result],
                "all_messages": state.get("all_messages", []) + [result],
                "node_outputs": state["node_outputs"],
            }
            return return_state
