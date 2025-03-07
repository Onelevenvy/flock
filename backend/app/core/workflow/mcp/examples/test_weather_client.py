import asyncio
import os
import sys
from typing import Any, Dict

from app.core.workflow.mcp.client.stdio import StdioMCPClient
from app.core.workflow.mcp.models.config import MCPServerConfig
from app.core.workflow.mcp.inspector.tools import MCPInspector


async def main():
    # 创建MCP客户端
    client = StdioMCPClient()
    inspector = MCPInspector(client)
    
    # 获取当前Python解释器路径
    python_executable = sys.executable
    server_script = os.path.join(os.path.dirname(__file__), "weather_server.py")
    
    # 配置天气服务器
    config = MCPServerConfig(
        name="weather",
        command=python_executable,  # 使用完整的Python路径
        args=[server_script],
        working_dir=os.path.dirname(__file__)
    )
    
    try:
        # 连接服务器
        print("连接到天气服务器...")
        print(f"使用Python解释器: {python_executable}")
        print(f"服务器脚本: {server_script}")
        await client.connect(config)
        
        # 列出可用工具
        print("\n获取可用工具...")
        tools = await client.list_tools("weather")
        print(f"可用工具: {tools}")
        
        # 测试天气预报
        print("\n获取纽约天气预报...")
        forecast = await inspector.execute_tool_with_inspection(
            "weather",
            "get_forecast",
            latitude=40.7128,
            longitude=-74.0060
        )
        print(f"纽约天气预报: {forecast}")
        
        print("\n获取北京天气预报...")
        forecast = await inspector.execute_tool_with_inspection(
            "weather",
            "get_forecast",
            latitude=39.9042,
            longitude=116.4074
        )
        print(f"北京天气预报: {forecast}")
        
        # 测试天气预警
        print("\n获取纽约天气预警...")
        alerts = await inspector.execute_tool_with_inspection(
            "weather",
            "get_alerts",
            region="NY"
        )
        print(f"纽约天气预警: {alerts}")
        
        print("\n获取北京天气预警...")
        alerts = await inspector.execute_tool_with_inspection(
            "weather",
            "get_alerts",
            region="BJ"
        )
        print(f"北京天气预警: {alerts}")
        
        # 获取性能指标
        print("\n获取性能指标...")
        metrics = inspector.get_metrics("weather")
        print(f"性能指标: {metrics}")
        
    finally:
        # 断开连接
        print("\n断开服务器连接...")
        await client.disconnect("weather")


if __name__ == "__main__":
    asyncio.run(main()) 