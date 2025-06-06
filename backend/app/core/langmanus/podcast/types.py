# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

from typing import Literal

from pydantic import BaseModel, Field


class ScriptLine(BaseModel):
    speaker: Literal["male", "female"] = Field(default="male")
    paragraph: str = Field(default="")


class Script(BaseModel):
    locale: Literal["en", "zh"] = Field(default="en")
    lines: list[ScriptLine] = Field(default=[])
