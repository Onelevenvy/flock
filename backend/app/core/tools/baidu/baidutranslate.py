import hashlib
import random

import requests
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from app.core.tools.response_formatter import format_tool_response
from app.core.tools.tool_manager import get_tool_provider_credential_value


class BaiduTranslateInput(BaseModel):
    """Input for the baiduTranslate tool."""

    content: str = Field(description="The text content you need to translate")
    dest: str = Field(description="The destination language you want to translate")


def baidu_translate_invoke(content: str, dest: str) -> str:
    try:
        appid = get_tool_provider_credential_value("baidu", "BAIDU_APPID")
        secretKey = get_tool_provider_credential_value("baidu", "BAIDU_SECRETKEY")

        if not appid or not secretKey:
            return format_tool_response(
                False, error="Baidu API credentials are not set."
            )

        from_lang = "auto"
        url = "https://fanyi-api.baidu.com/api/trans/vip/translate"
        # 拼接成随机数签名
        salt = str(random.randint(1, 1000000))
        # 需按照固定拼接顺序
        sign = appid + content + salt + secretKey
        m = hashlib.md5()
        m.update(sign.encode("utf-8"))
        sign = m.hexdigest()

        # 必填参数：appid:开发者ID，q：需要翻译的内容，from：原语言，to：目标语言，salt：随机数（用于签名加密），sign：签名（MD5(appid + q + salt + secretKey))
        params = {
            "appid": appid,
            "q": content,
            "from": from_lang,
            "to": dest,
            "salt": salt,
            "sign": sign,
        }

        response = requests.get(url, params=params)
        result = response.json()

        if "trans_result" in result:
            return format_tool_response(True, result["trans_result"][0]["dst"])
        else:
            return format_tool_response(False, error=f"翻译失败: {result}")

    except Exception as e:
        return format_tool_response(False, error=f"请求失败: {str(e)}")


baidutranslate = StructuredTool.from_function(
    func=baidu_translate_invoke,
    name="Baidu Translate",
    description="Useful for when you neet to translate.",
    args_schema=BaiduTranslateInput,
    return_direct=False,
)
