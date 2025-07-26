import base64

import zhipuai
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response
from app.core.tools.tool_manager import get_tool_provider_credential_value


class ImageUnderstandingInput(BaseModel):
    """Input for the Image Understanding tool."""

    qry: str = Field(description="the input query for the Image Understanding tool")
    image_url: str = Field(description="the path or the url of the image")


def img_4v(image_url: str, qry: str):
    if image_url is None:
        return format_tool_response(False, error="Please provide an image path or url")

    if (
        image_url.startswith("http")
        or image_url.startswith("https")
        or image_url.startswith("data:image/")
    ):
        img_base = image_url
    else:
        try:
            with open(image_url, "rb") as img_file:
                img_base = base64.b64encode(img_file.read()).decode("utf-8")
        except Exception as e:
            return format_tool_response(False, error=str(e))

    api_key = get_tool_provider_credential_value("zhipuai", "ZHIPUAI_API_KEY")

    if not api_key:
        return format_tool_response(False, error="ZhipuAI API Key is not set.")

    try:
        client = zhipuai(api_key=api_key)
        response = client.chat.completions.create(
            model="glm-4v",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": img_base}},
                        {"type": "text", "text": qry},
                    ],
                }
            ],
        )

        return format_tool_response(True, response.choices[0].message)
    except Exception as e:
        return format_tool_response(
            False, error=f"Image understanding failed: {str(e)}"
        )


img_understanding = StructuredTool.from_function(
    func=img_4v,
    name="Image Understanding",
    description="Users input an image and a question, and the LLM can identify objects, scenes, and other information in the image to answer the user's question.",
    args_schema=ImageUnderstandingInput,
    return_direct=False,
)
