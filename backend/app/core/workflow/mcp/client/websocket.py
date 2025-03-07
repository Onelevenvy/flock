import asyncio
import json
from typing import Any, Dict, List, Optional
import websockets
from websockets.client import WebSocketClientProtocol

from .base import BaseMCPClient
from ..models.config import MCPServerConfig
from ..exceptions import MCPConnectionError, MCPToolExecutionError


class WebSocketMCPClient(BaseMCPClient):
    """MCP client implementation using WebSocket transport"""
    
    async def connect(self, config: MCPServerConfig) -> None:
        if config.name in self._servers:
            await self.disconnect(config.name)
            
        try:
            # Connect to WebSocket server
            websocket = await websockets.connect(
                config.command,  # Using command field as WebSocket URL
                extra_headers=config.env,  # Using env field as headers
            )
            
            self._servers[config.name] = {
                "websocket": websocket,
                "config": config
            }
        except Exception as e:
            raise MCPConnectionError(f"Failed to connect to {config.name}: {str(e)}")
            
    async def disconnect(self, server_name: str) -> None:
        if server_name not in self._servers:
            return
            
        server = self._servers[server_name]
        websocket = server["websocket"]
        
        try:
            await websocket.close()
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
        websocket: WebSocketClientProtocol = server["websocket"]
        
        # Prepare tool execution request
        request = {
            "type": "tool_call",
            "tool": tool_name,
            "params": params
        }
        
        try:
            # Send request
            await websocket.send(json.dumps(request))
            
            # Read response
            response_str = await websocket.recv()
            response = json.loads(response_str)
            
            if response.get("error"):
                raise MCPToolExecutionError(response["error"])
                
            return response.get("result")
        except Exception as e:
            raise MCPToolExecutionError(f"Tool execution failed: {str(e)}")
            
    async def list_tools(self, server_name: str) -> List[Dict[str, Any]]:
        if server_name not in self._servers:
            raise ValueError(f"Server {server_name} not connected")
            
        # Request tool list
        tools = await self.execute_tool(server_name, "__list_tools")
        return tools 