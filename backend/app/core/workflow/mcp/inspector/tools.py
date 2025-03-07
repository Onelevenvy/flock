import time
from typing import Any, Dict, List, Optional

from ..models.tool import MCPTool
from ..client.base import BaseMCPClient


class MCPInspector:
    """MCP Inspector for debugging and monitoring"""
    
    def __init__(self, client: BaseMCPClient):
        self.client = client
        self._call_history: List[Dict[str, Any]] = []
        
    async def inspect_tool(self, server_name: str, tool_name: str) -> Dict[str, Any]:
        """Inspect a specific tool"""
        tools = await self.client.list_tools(server_name)
        tool = next((t for t in tools if t["name"] == tool_name), None)
        
        if not tool:
            raise ValueError(f"Tool {tool_name} not found on server {server_name}")
            
        return {
            "tool": tool,
            "server": server_name,
            "calls": [
                call for call in self._call_history 
                if call["server"] == server_name and call["tool"] == tool_name
            ]
        }
        
    async def execute_tool_with_inspection(
        self,
        server_name: str,
        tool_name: str,
        **params: Any
    ) -> Any:
        """Execute a tool and record metrics"""
        start_time = time.time()
        error = None
        result = None
        
        try:
            result = await self.client.execute_tool(server_name, tool_name, **params)
        except Exception as e:
            error = str(e)
            raise
        finally:
            end_time = time.time()
            duration = end_time - start_time
            
            # Record call
            self._call_history.append({
                "server": server_name,
                "tool": tool_name,
                "params": params,
                "duration": duration,
                "timestamp": start_time,
                "error": error,
                "success": error is None
            })
            
        return result
        
    def get_metrics(self, server_name: Optional[str] = None) -> Dict[str, Any]:
        """Get execution metrics"""
        calls = self._call_history
        if server_name:
            calls = [c for c in calls if c["server"] == server_name]
            
        total_calls = len(calls)
        successful_calls = len([c for c in calls if c["success"]])
        failed_calls = total_calls - successful_calls
        
        if total_calls > 0:
            avg_duration = sum(c["duration"] for c in calls) / total_calls
        else:
            avg_duration = 0
            
        return {
            "total_calls": total_calls,
            "successful_calls": successful_calls,
            "failed_calls": failed_calls,
            "average_duration": avg_duration,
            "calls_by_tool": self._group_calls_by_tool(calls)
        }
        
    def _group_calls_by_tool(self, calls: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Group call statistics by tool"""
        result = {}
        
        for call in calls:
            tool_key = f"{call['server']}/{call['tool']}"
            if tool_key not in result:
                result[tool_key] = {
                    "total_calls": 0,
                    "successful_calls": 0,
                    "failed_calls": 0,
                    "total_duration": 0
                }
                
            stats = result[tool_key]
            stats["total_calls"] += 1
            if call["success"]:
                stats["successful_calls"] += 1
            else:
                stats["failed_calls"] += 1
            stats["total_duration"] += call["duration"]
            
        # Calculate averages
        for stats in result.values():
            stats["average_duration"] = (
                stats["total_duration"] / stats["total_calls"]
                if stats["total_calls"] > 0
                else 0
            )
            
        return result 