from enum import Enum
from typing import Any

from pydantic import BaseModel


class ToolInvokeMessage(BaseModel):
    class MessageType(Enum):
        TEXT = "text"
        IMAGE = "image"
        LINK = "link"
        BLOB = "blob"
        JSON = "json"
        IMAGE_LINK = "image_link"

    type: MessageType = MessageType.TEXT
    """
        plain text, image url or link url
    """
    message: str | bytes | dict = None
    meta: dict[str, Any] = None
    save_as: str = ""


def create_image_message(image: str, save_as: str = "") -> ToolInvokeMessage:
    """
    create an image message

    :param image: the url of the image
    :return: the image message
    """
    return ToolInvokeMessage(
        type=ToolInvokeMessage.MessageType.IMAGE, message=image, save_as=save_as
    )


def create_link_message(link: str, save_as: str = "") -> ToolInvokeMessage:
    """
    create a link message

    :param link: the url of the link
    :return: the link message
    """
    return ToolInvokeMessage(
        type=ToolInvokeMessage.MessageType.LINK, message=link, save_as=save_as
    )


def create_text_message(text: str, save_as: str = "") -> ToolInvokeMessage:
    """
    create a text message

    :param text: the text
    :return: the text message
    """
    return ToolInvokeMessage(
        type=ToolInvokeMessage.MessageType.TEXT, message=text, save_as=save_as
    )


def create_blob_message(
    blob: bytes, meta: dict = None, save_as: str = ""
) -> ToolInvokeMessage:
    """
    create a blob message

    :param blob: the blob
    :return: the blob message
    """
    return ToolInvokeMessage(
        type=ToolInvokeMessage.MessageType.BLOB,
        message=blob,
        meta=meta,
        save_as=save_as,
    )


def create_json_message(object: dict) -> ToolInvokeMessage:
    """
    create a json message
    """
    return ToolInvokeMessage(type=ToolInvokeMessage.MessageType.JSON, message=object)
