import asyncio
import json
from typing import Any, Dict, List, Optional

from .base import BaseMCPClient
from ..models.config import MCPServerConfig


class StdioMCPClient(BaseMCPClient):
    """MCP client implementation using stdio transport"""
    
    async def connect(self, config: MCPServerConfig) -> None:
        if config.name in self._servers:
            await self.disconnect(config.name)
            
        # Create subprocess
        process = await asyncio.create_subprocess_exec(
            config.command,
            *config.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=config.working_dir,
            env=config.env
        )
        
        self._servers[config.name] = {
            "process": process,
            "config": config
        }
        
    async def disconnect(self, server_name: str) -> None:
        if server_name not in self._servers:
            return
            
        server = self._servers[server_name]
        process = server["process"]
        
        try:
            process.terminate()
            await process.wait()
        except:
            pass
            
        del self._servers[server_name]
        
    async def execute_tool(
        self, 
        server_name: str, 
        tool_name: str, 
        **params: Any
    ) -> Any:
        if server_name not in self._servers:
            raise ValueError(f"Server {server_name} not connected")
            
        server = self._servers[server_name]
        process = server["process"]
        
        # Prepare tool execution request
        request = {
            "type": "tool_call",
            "tool": tool_name,
            "params": params
        }
        
        # Send request
        request_str = json.dumps(request) + "\n"
        process.stdin.write(request_str.encode())
        await process.stdin.drain()
        
        # Read response
        response_str = await process.stdout.readline()
        response = json.loads(response_str)
        
        if response.get("error"):
            raise Exception(response["error"])
            
        return response.get("result")
        
    async def list_tools(self, server_name: str) -> List[Dict[str, Any]]:
        if server_name not in self._servers:
            raise ValueError(f"Server {server_name} not connected")
            
        # Request tool list
        tools = await self.execute_tool(server_name, "__list_tools")
        return tools 