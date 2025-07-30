import requests
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response
from app.core.tools.tool_manager import get_tool_provider_credential_value


class Text2ImageInput(BaseModel):
    """Input for the text2img tool."""

    prompt: str = Field(description="the prompt for generating image ")


def text2img(
    prompt: str,
):
    """
    invoke tools
    """
    api_key = get_tool_provider_credential_value("siliconflow", "SILICONFLOW_API_KEY")

    if not api_key:
        return format_tool_response(False, error="Siliconflow API Key is not set.")

    try:
        # request URL
        url = "https://api.siliconflow.cn/v1/image/generations"

        payload = {
            # "model": "black-forest-labs/FLUX.1-schnell",
            "model": "stabilityai/stable-diffusion-3-medium",
            "prompt": prompt,
            "image_size": "1024x1024",
        }
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "authorization": f"Bearer {api_key}",
        }

        response = requests.post(url, json=payload, headers=headers)

        if response.status_code == 200:
            image_url = response.json()["images"][0]["url"]
            return format_tool_response(True, image_url)
        else:
            error_message = f"API request failed with status code {response.status_code}: {response.text}"
            return format_tool_response(False, error=error_message)

    except Exception as e:
        return format_tool_response(False, error=f"Image generation failed: {str(e)}")


siliconflow_img_generation = StructuredTool.from_function(
    func=text2img,
    name="Image Generation",
    description="Siliconflow Image Generation is a tool that can generate images from text prompts using the Siliconflow API.",
    args_schema=Text2ImageInput,
    return_direct=False,
)
