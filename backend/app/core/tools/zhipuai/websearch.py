import json
import uuid

import requests
from langchain.pydantic_v1 import BaseModel, Field
from langchain.tools import StructuredTool

from app.core.tools.utils import get_credential_value


class WebSearchInput(BaseModel):
    """Input for the web search tool."""

    query: str = Field(description="search query")


def web_search_query(query: str) -> str:
    """
    Invoke Web Search API
    """
    api_key = get_credential_value("Web Search Pro", "ZHIPUAI_API_KEY")

    if not api_key:
        return "Error: Web Search API Key is not set."

    try:
        url = "https://open.bigmodel.cn/api/paas/v4/tools"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        data = {
            "request_id": str(uuid.uuid4()),
            "tool": "web-search-pro",
            "stream": False,
            "messages": [{"role": "user", "content": query}],
        }
        response = requests.post(url, headers=headers, json=data, timeout=300)

        if response.status_code == 200:
            result = response.json()
            if "choices" in result and len(result["choices"]) > 0:
                message = result["choices"][0].get("message", {})
                tool_calls = message.get("tool_calls", [])
                search_results = []
                for call in tool_calls:
                    if call.get("type") == "search_result":
                        search_results.extend(call.get("search_result", []))

                formatted_results = []
                for item in search_results:
                    formatted_results.append(
                        {
                            "title": item.get("title", ""),
                            "content": item.get("content", ""),
                            "link": item.get("link", ""),
                            "media": item.get("media", ""),
                        }
                    )
                return json.dumps(formatted_results, ensure_ascii=False)
            else:
                return json.dumps({"error": "No search results found"})
        else:
            error_message = {
                "error": f"HTTP request failed: {response.status_code}",
                "data": response.text,
            }
            return json.dumps(error_message)

    except Exception as e:
        return json.dumps(f"Web Search API request failed. {e}")


websearch = StructuredTool.from_function(
    func=web_search_query,
    name="Web Search Pro",
    description="Useful for when you need to search for information on the web. Please provide a search query.",
    args_schema=WebSearchInput,
    return_direct=True,
)
