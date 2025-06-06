# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

from langgraph.graph import MessagesState


class ProseState(MessagesState):
    """State for the prose generation."""

    # The content of the prose
    content: str = ""

    # Prose writer option: continue, improve, shorter, longer, fix, zap
    option: str = ""

    # The user custom command for the prose writer
    command: str = ""

    # Output
    output: str = ""
