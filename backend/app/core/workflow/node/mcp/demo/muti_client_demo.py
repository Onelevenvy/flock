import asyncio

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent


async def main():
    model = ChatOpenAI(
        model="glm-4-flash",
        temperature=0.01,
        openai_api_key="your_api_key",
        openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
    )

    async with MultiServerMCPClient(
        {
            "math": {
                "command": "python",
                # Make sure to update to the full absolute path to your math_server.py file
                "args": [
                    "/home/tqx/llm/flock/backend/app/core/workflow/node/mcp/demo/servers/math_server.py"
                ],
                "transport": "stdio",
            },
             "Hacker-News": {
                "command": "node",
                # Make sure to update to the full absolute path to your math_server.py file
                "args": [
                    "/home/tqx/llm/flock/backend/app/core/workflow/node/mcp/demo/servers/hn-server-js/build/index.js"
                ],
                "transport": "stdio",
            },
            "weather": {
                # make sure you start your weather server on port 8000
                "url": "http://localhost:8123/sse",
                "transport": "sse",
            },
        }
    ) as client:
        agent = create_react_agent(model, client.get_tools())
        # math_response = await agent.ainvoke({"messages": "what's (3 + 5) x 12?"})
        # print(math_response)
        # print("--------------------------------")
        # weather_response = await agent.ainvoke(
        #     {"messages": "what is the weather in nyc?"}
        # )
        # print(weather_response)
        # print("--------------------------------")
        hn_response = await agent.ainvoke(
            {"messages": "what is the top 5 stories in hacker news?"}
        )
        print(hn_response)


if __name__ == "__main__":
    asyncio.run(main())
