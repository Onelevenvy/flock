import base64
import hashlib
import hmac
import json
from datetime import datetime
from time import mktime
from urllib.parse import urlencode
from wsgiref.handlers import format_date_time

import requests
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool

from app.core.tools.utils import get_credential_value
from app.core.workflow.utils.db_utils import db_operation


class Text2ImageInput(BaseModel):
    """Input for the text2img tool."""

    prompt: str = Field(description="the prompt for generating image ")


class AssembleHeaderError(Exception):
    def __init__(self, msg):
        self.message = msg


class Url:
    def __init__(self, host, path, schema):
        self.host = host
        self.path = path
        self.schema = schema


# calculate sha256 and encode to base64
def sha256base64(data):
    sha256 = hashlib.sha256()
    sha256.update(data)
    digest = base64.b64encode(sha256.digest()).decode(encoding="utf-8")
    return digest


def parse_url(request_url):
    stidx = request_url.index("://")
    host = request_url[stidx + 3 :]
    schema = request_url[: stidx + 3]
    edidx = host.index("/")
    if edidx <= 0:
        raise AssembleHeaderError("invalid request url:" + request_url)
    path = host[edidx:]
    host = host[:edidx]
    u = Url(host, path, schema)
    return u


def assemble_ws_auth_url(request_url, method="GET", api_key="", api_secret=""):
    u = parse_url(request_url)
    host = u.host
    path = u.path
    now = datetime.now()
    date = format_date_time(mktime(now.timetuple()))
    signature_origin = "host: {}\ndate: {}\n{} {} HTTP/1.1".format(
        host, date, method, path
    )
    signature_sha = hmac.new(
        api_secret.encode("utf-8"),
        signature_origin.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    signature_sha = base64.b64encode(signature_sha).decode(encoding="utf-8")
    authorization_origin = f'api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_sha}"'

    authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode(
        encoding="utf-8"
    )
    values = {"host": host, "date": date, "authorization": authorization}

    return request_url + "?" + urlencode(values)


def get_body(appid, text):
    body = {
        "header": {"app_id": appid, "uid": "123456789"},
        "parameter": {
            "chat": {"domain": "general", "temperature": 0.5, "max_tokens": 4096}
        },
        "payload": {"message": {"text": [{"role": "user", "content": text}]}},
    }
    return body


def spark_response(text, appid, apisecret, apikey):
    host = "http://spark-api.cn-huabei-1.xf-yun.com/v2.1/tti"
    url = assemble_ws_auth_url(
        host, method="POST", api_key=apikey, api_secret=apisecret
    )
    content = get_body(appid, text)
    try:
        response = requests.post(
            url, json=content, headers={"content-type": "application/json"}
        ).text
        return response
    except Exception as e:
        return json.dumps(f"There is a error occured . {e}")


def img_generation(prompt: str):
    creds = {
        "appid": db_operation(
            get_credential_value("Spark Image Generation", "SPARK_APPID")
        ),
        "apisecret": db_operation(
            get_credential_value("Spark Image Generation", "SPARK_APISECRET")
        ),
        "apikey": db_operation(
            get_credential_value("Spark Image Generation", "SPARK_APIKEY")
        ),
    }

    if not all(creds.values()):
        return "Error: Spark credentials are not set correctly."

    response = spark_response(
        text=prompt,
        appid=creds["appid"],
        apisecret=creds["apisecret"],
        apikey=creds["apikey"],
    )
    try:
        data = json.loads(response)
        code = data["header"]["code"]
        if code != 0:
            return f"error: {code}, {data}"
        else:
            text = data["payload"]["choices"]["text"]
            image_content = text[0]
            image_base = image_content["content"]
            bs64data = "data:image/jpeg;base64," + image_base
            return bs64data
    except Exception as e:
        return json.dumps(f"There is an error occurred: {e}")


spark_img_generation = StructuredTool.from_function(
    func=img_generation,
    name="Spark Image Generation",
    description="Spark Image Generation is a tool that can generate images from text prompts using the Spark API.",
    args_schema=Text2ImageInput,  
    return_direct=True,
)
