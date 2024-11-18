import logging
import asyncio
from app.core.workflow.node.code.code_node import CodeNode

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)

# 使用更安全的字符串格式，避免引号和换行符问题
test_code = '''
print('=== Python Code Execution Test ===')

# 基本计算
x = 10
y = 5
result = x + y
print(f'Basic Math: {x} + {y} = {result}')

# 使用 numpy
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f'NumPy Array: {arr}')
print(f'Array Mean: {arr.mean()}')

# 使用 pandas
import pandas as pd
data = {
    'A': [1, 2, 3],
    'B': ['a', 'b', 'c']
}
df = pd.DataFrame(data)
print('\\nPandas DataFrame:')
print(df)

print('\\n=== Test Complete ===')
'''

async def test_code_execution():
    print("\n=== Starting Code Execution Test ===")
    logger.info("Starting Code Execution Test")
    
    code_node = None
    try:
        print("Creating CodeNode...")
        code_node = CodeNode(
            node_id="test-code",
            code=test_code,
            libraries=["numpy", "pandas"],
            timeout=30,
            memory_limit="256m"
        )
        
        test_state = {
            "node_outputs": {},
            "history": [],
            "all_messages": []
        }
        
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