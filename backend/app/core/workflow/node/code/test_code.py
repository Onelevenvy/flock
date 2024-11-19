import logging
import asyncio
from app.core.workflow.node.code.code_node import CodeNode

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", force=True
)
logger = logging.getLogger(__name__)

# 测试带返回值的函数
test_code = r"""
def main():
    # 使用预装的库
    import numpy as np
    import pandas as pd
    
    # 创建示例数据
    data = {
        'numbers': np.random.randn(5),
        'letters': ['A', 'B', 'C', 'D', 'E']
    }
    
    # 创建 DataFrame
    df = pd.DataFrame(data)
    
    # 计算一些统计信息
    result = {
        'mean': float(df['numbers'].mean()),  # 转换为普通 float
        'std': float(df['numbers'].std()),    # 转换为普通 float
        'letters': df['letters'].tolist()
    }
    
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
            libraries=[],  # 使用预装库
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
