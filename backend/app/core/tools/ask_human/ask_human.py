from langchain.tools import StructuredTool
from pydantic import BaseModel, Field


class AskHumanInput(BaseModel):
    question: str = Field(description="Question to ask the human")


def ask_human_tool():
    pass


ask_human = StructuredTool.from_function(
    func=ask_human_tool,
    name="ask-human",
    description=" A tool for asking the human a question to gather additional inputs",
    args_schema=AskHumanInput,
    return_direct=True,
)
