import requests
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response
from app.core.tools.tool_manager import get_tool_provider_credential_value


class SerperDevToolSchema(BaseModel):
    """Input for SerperDevTool."""

    search_query: str = Field(..., description="Search query to search the internet")


def serper_search(search_query: str) -> str:
    """
    Search the internet using Serper API
    """
    api_key = get_tool_provider_credential_value("serper", "SERPER_API_KEY")

    if not api_key:
        return format_tool_response(False, error="Serper API Key is not set.")

    try:
        url = "https://google.serper.dev/search"
        payload = {"q": search_query, "num": 10}

        headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            results = response.json()
            if "organic" in results:
                results = results["organic"][:10]
                string = []
                for result in results:
                    try:
                        string.append(
                            "\n".join(
                                [
                                    f"Title: {result['title']}",
                                    f"Link: {result['link']}",
                                    f"Snippet: {result['snippet']}",
                                    "---",
                                ]
                            )
                        )
                    except KeyError:
                        continue
                return format_tool_response(True, "\n".join(string))
            return format_tool_response(True, results)
        else:
            error_message = f"API request failed with status code {response.status_code}: {response.text}"
            return format_tool_response(False, error=error_message)

    except Exception as e:
        return format_tool_response(False, error=f"Serper API request failed: {str(e)}")


serper = StructuredTool.from_function(
    func=serper_search,
    name="Serper Search",
    description="A tool that can be used to search the internet. Input should be a search query.",
    args_schema=SerperDevToolSchema,
    return_direct=False,
)
