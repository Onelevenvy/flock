import asyncio

from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    model = ChatOpenAI(
        model="glm-4-flash",
        temperature=0.01,
        openai_api_key="your_api_key",
        openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
    )

    server_params = StdioServerParameters(
        command="python",
        args=["/home/tqx/llm/flock/backend/app/core/workflow/node/mcp/math_server.py"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()

            # Get tools
            tools = await load_mcp_tools(session)

            # Create and run the agent
            agent = create_react_agent(model, tools)
            agent_response = await agent.ainvoke({"messages": "what's (3 + 5) x 12?"})
            print(agent_response)


if __name__ == "__main__":
    asyncio.run(main())
