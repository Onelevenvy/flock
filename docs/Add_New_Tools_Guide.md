# 🛠️ Tools Guide

## Built-in Tools

Flock comes with several built-in tools:

### AI Service Tools
- **Web Search Pro**: Search the internet using ZhipuAI's web search capabilities
- **Qingyan Assistant**: A versatile AI assistant that can help with various tasks including:
  - Data analysis
  - Creating flowcharts
  - Mind mapping
  - Prompt engineering
  - AI drawing
  - AI search
- **Image Understanding**: Analyze and understand images using ZhipuAI's vision capabilities

### Image Generation Tools
- **Spark Image Generation**: Generate images using Spark's API
- **Siliconflow Image Generation**: Generate images using Siliconflow's API

### Utility Tools
- **Math Calculator**: Perform mathematical calculations locally using NumExpr
- **Google Translate**: Translate text between languages using Google Translate
- **Open Weather**: Get weather information for any city
- **Ask Human**: Request human intervention or input during execution

### External Search Tools
- **DuckDuckGo Search**: Web search using DuckDuckGo
- **Wikipedia**: Search and retrieve information from Wikipedia

## How to Add Custom Tools

You can easily add new tools to Flock by following these steps:

### 1. Create Tool Directory

Create a new directory under `backend/app/core/tools/` with your tool name:

```bash
mkdir backend/app/core/tools/your_tool_name
```

### 2. Create Tool Files

Inside your tool directory, create these files:

#### 2.1. `__init__.py`
```python
from .your_tool import your_tool_instance

__all__ = ["your_tool_instance"]
```

#### 2.2. `your_tool.py`
```python
from langchain.pydantic_v1 import BaseModel, Field
from langchain.tools import StructuredTool

class YourToolInput(BaseModel):
    """Input schema for your tool."""
    param1: str = Field(description="Description of parameter 1")
    param2: int = Field(description="Description of parameter 2")

def your_tool_function(param1: str, param2: int) -> str:
    """
    Your tool's main functionality.
    """
    # Implement your tool's logic here
    result = f"Processed {param1} with {param2}"
    return result

your_tool_instance = StructuredTool.from_function(
    func=your_tool_function,
    name="Your Tool Name",
    description="Description of what your tool does",
    args_schema=YourToolInput,
    return_direct=True,
)
```

#### 2.3. `credentials.py` (Optional)
If your tool requires API keys or other credentials:

```python
from typing import Any, Dict

YOUR_TOOL_CREDENTIALS = {
    "API_KEY": {
        "type": "string",
        "description": "API key for your service",
        "value": "",
    },
    "API_SECRET": {
        "type": "string",
        "description": "API secret for your service",
        "value": "",
    }
}

def get_credentials() -> Dict[str, Any]:
    return YOUR_TOOL_CREDENTIALS
```

### 3. Access Credentials in Your Tool

If your tool needs to use credentials:

```python
from app.core.tools.utils import get_credential_value

def your_tool_function(param1: str, param2: int) -> str:
    api_key = get_credential_value("Your Tool Name", "API_KEY")
    api_secret = get_credential_value("Your Tool Name", "API_SECRET")
    
    if not api_key or not api_secret:
        return "Error: Required credentials are not set."
        
    # Use credentials in your implementation
    ...
```

### 4. Tool Registration

Your tool will be automatically registered when Flock starts up, thanks to the tool manager system. The tool manager:
- Scans the tools directory
- Loads all tools with proper `__all__` exports
- Makes them available in the system

### Best Practices

1. **Input Validation**: Use Pydantic models to validate input parameters
2. **Error Handling**: Always include proper error handling in your tool
3. **Documentation**: Provide clear descriptions for your tool and its parameters
4. **Credentials**: If your tool requires API keys, use the credentials system
5. **Return Values**: Return clear, structured responses that can be easily processed

### Example Tool Implementation

Here's a complete example of a simple weather tool:

```python
import requests
from langchain.pydantic_v1 import BaseModel, Field
from langchain.tools import StructuredTool
from app.core.tools.utils import get_credential_value

class WeatherInput(BaseModel):
    """Input for the weather tool."""
    city: str = Field(description="Name of the city")

def get_weather(city: str) -> str:
    """Get weather information for a city."""
    api_key = get_credential_value("Weather Tool", "API_KEY")
    
    if not api_key:
        return "Error: Weather API Key is not set."
        
    try:
        response = requests.get(
            f"https://api.weather.com/data",
            params={"city": city, "key": api_key}
        )
        return response.json()
    except Exception as e:
        return f"Error getting weather data: {str(e)}"

weather_tool = StructuredTool.from_function(
    func=get_weather,
    name="Weather Tool",
    description="Get weather information for any city",
    args_schema=WeatherInput,
    return_direct=True,
) 