import json
import requests
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool
from app.core.tools.utils import get_credential_value


class SerperDevToolSchema(BaseModel):
    """Input for SerperDevTool."""

    search_query: str = Field(..., description="Search query to search the internet")


def serper_search(search_query: str) -> str:
    """
    Search the internet using Serper API
    """
    api_key = get_credential_value("Serper Search", "SERPER_API_KEY")

    if not api_key:
        return "Error: Serper API Key is not set."

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
                return "\n".join(string)
            return json.dumps(results)
        else:
            error_message = {
                "error": f"failed:{response.status_code}",
                "data": response.text,
            }
            return json.dumps(error_message)

    except Exception as e:
        return json.dumps(f"Serper API request failed. {e}")


serper = StructuredTool.from_function(
    func=serper_search,
    name="Serper Search",
    description="A tool that can be used to search the internet. Input should be a search query.",
    args_schema=SerperDevToolSchema,
    return_direct=True,
)
