import logging
import asyncio
from app.core.workflow.node.code.code_node import CodeNode

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", force=True
)
logger = logging.getLogger(__name__)

# 使用 r-string 和三重引号，避免转义问题
test_code = r"""
import os
import json
from datetime import datetime

# 基本操作
current_time = datetime.now()
print(f'Current time: {current_time}')

# 文件系统操作
files = os.listdir('.')
print('\nFiles in current directory:')
print(json.dumps(files, indent=2))

# 使用预装的 numpy
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f'\nNumPy array mean: {arr.mean()}')
"""  # 使用 r-string 和三重引号


async def test_code_execution():
    print("\n=== Starting Code Execution Test ===")
    logger.info("Starting Code Execution Test")

    code_node = None
    try:
        print("Creating CodeNode...")
        code_node = CodeNode(
            node_id="test-code",
            code=test_code,
            # 由于使用的都是预装库，可以不指定 libraries
            libraries=[],  # 移除不必要的库声明
            timeout=30,
            memory_limit="256m",
        )

        test_state = {"node_outputs": {}, "history": [], "all_messages": []}

        print("Executing code...")
        result = await code_node.work(test_state, {})

        print("\n=== Execution Result ===")
        print(result["messages"][0].content)

    except Exception as e:
        print(f"Test failed: {e}")
        logger.error(f"Test failed: {e}")
        raise

    finally:
        if code_node and code_node.executor:
            try:
                print("\nCleaning up resources...")
                code_node.executor.cleanup()
            except Exception as e:
                print(f"Cleanup error: {e}")
                logger.error(f"Cleanup error: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(test_code_execution())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"\nTest failed with error: {e}")
