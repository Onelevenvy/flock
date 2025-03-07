from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from ..models.config import MCPServerConfig


class BaseMCPClient(ABC):
    """Base abstract class for MCP clients"""
    
    def __init__(self):
        self._servers: Dict[str, Any] = {}
        
    @abstractmethod
    async def connect(self, config: MCPServerConfig) -> None:
        """Connect to an MCP server"""
        pass
        
    @abstractmethod
    async def disconnect(self, server_name: str) -> None:
        """Disconnect from an MCP server"""
        pass
        
    @abstractmethod
    async def execute_tool(
        self, 
        server_name: str, 
        tool_name: str, 
        **params: Any
    ) -> Any:
        """Execute a tool on the specified server"""
        pass
        
    @abstractmethod
    async def list_tools(self, server_name: str) -> List[Dict[str, Any]]:
        """List available tools on the specified server"""
        pass
        
    def is_connected(self, server_name: str) -> bool:
        """Check if a server is connected"""
        return server_name in self._servers 