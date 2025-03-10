# weather_server.py

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Weather", port=8123)


@mcp.tool()
async def get_weather(location: str) -> int:
    """Get weather for location."""
    return "It's always sunny in New York"


if __name__ == "__main__":
    mcp.run(transport="sse")
