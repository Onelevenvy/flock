import json

import requests
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool

from app.core.tools.utils import get_credential_value


class Text2ImageInput(BaseModel):
    """Input for the text2img tool."""

    prompt: str = Field(description="the prompt for generating image ")


def text2img(
    prompt: str,
):
    """
    invoke tools
    """
    api_key = get_credential_value("Image Generation", "SILICONFLOW_API_KEY")

    if not api_key:
        return "Error: Siliconflow API Key is not set."

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
            return response.json()["images"][0]["url"]
        else:
            return f"Error: API request failed with status code {response.status_code}"

    except Exception as e:
        return json.dumps(f"There is an error occurred: {e}")


siliconflow_img_generation = StructuredTool.from_function(
    func=text2img,
    name="Image Generation",
    description="Siliconflow Image Generation is a tool that can generate images from text prompts using the Siliconflow API.",
    args_schema=Text2ImageInput,
    return_direct=True,
)
