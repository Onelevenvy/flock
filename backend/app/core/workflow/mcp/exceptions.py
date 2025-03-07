class MCPError(Exception):
    """Base exception for MCP errors"""
    pass


class MCPConnectionError(MCPError):
    """Raised when connection to MCP server fails"""
    pass


class MCPToolExecutionError(MCPError):
    """Raised when tool execution fails"""
    pass


class MCPServerNotFoundError(MCPError):
    """Raised when trying to interact with a non-existent server"""
    pass