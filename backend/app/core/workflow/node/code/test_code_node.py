import logging
import asyncio
from app.core.workflow.node.code.code_node import CodeNode

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", force=True
)
logger = logging.getLogger(__name__)

# 使用 r-string 和三重引号，避免转义问题
test_code = r"""
def main():
    # 绑定两个数字
    num1 = 5
    num2 = 3
    
    # 进行加法运算
    result = num1 + num2
    
    # 输出结果
    return result
"""


async def test_code_execution():
    print("\n=== Starting Code Execution Test ===")
    logger.info("Starting Code Execution Test")

    code_node = None
    try:
        print("Creating CodeNode...")
        code_node = CodeNode(
            node_id="test-code",
            code=test_code,
            libraries=[],  # 不需要额外的库
            timeout=30,
            memory_limit="256m",
        )

        test_state = {"node_outputs": {}, "history": [], "all_messages": []}

        print("Executing code...")
        result = await code_node.work(test_state, {})

        print("\n=== Execution Result ===")
        print("Node outputs:", result["node_outputs"])
        print(
            "\nFunction return value:", result["node_outputs"]["test-code"]["response"]
        )

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
