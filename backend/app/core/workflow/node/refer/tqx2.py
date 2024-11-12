import platform
from langgraph.prebuilt import ToolExecutor
from langchain_community.document_loaders import WebBaseLoader
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from typing import List, Any
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables.base import Other
from langchain_core.tools import create_retriever_tool
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.prebuilt import chat_agent_executor, ToolInvocation

QUESTION_CLASSIFIER_COMPLETION_PROMPT = """
### Job Description
You are a text classification engine that analyzes text data and assigns categories based on user input or automatically determined categories.
### Task
Your task is to assign one categories ONLY to the input text and only one category may be assigned returned in the output.  Additionally, you need to extract the key words from the text that are related to the classification.
### Format
The input text is in the variable text_field. Categories are specified as a category list  with  category_name in the variable categories. 
### Constraint 
DO NOT include anything other than the JSON array in your response.
### Example
Here is the chat example between human and assistant, inside <example></example> XML tags.
<example>
User:{{"input_text": ["I recently had a great experience with your company. The service was prompt and the staff was very friendly."], "categories": ["Customer Service","Satisfaction","Sales","Product"]}}
Assistant:{{"keywords": ["recently", "great experience", "company", "service", "prompt", "staff", "friendly"],"category_name": "Customer Service"}}
User:{{"input_text": ["bad service, slow to bring the food"], "categories": ["Food Quality","Experience","Price"]}}
Assistant:{{"keywords": ["bad service", "slow", "food", "tip", "terrible", "waitresses"],"category_name": "Experience"}}
</example> 
"""

QUESTION_CLASSIFIER_USER_PROMPT = """
    {input_text},
    {categories},
    返回的类别必须要在categories中，需要编造categories
"""


class QuestionClassifilerNode:
    def __init__(self, categories: List[str], llm: Runnable[Any, Other]):
        if not isinstance(categories, list):
            raise TypeError("categories must be a list")

        self.categories = categories
        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", QUESTION_CLASSIFIER_COMPLETION_PROMPT),
                ("user", QUESTION_CLASSIFIER_USER_PROMPT),
            ]
        )
        self.llm = llm
        self.outputparser = JsonOutputParser()

    def invoke(self, input_text):
        chain = self.prompt | self.llm | self.outputparser
        response = chain.invoke(
            {"input_text": input_text, "categories": self.categories}
        )
        return response


class SamsunInfoNode:
    def __init__(self, model, embeddings):
        self.llm = model
        self.embeddings = embeddings

    def invoke(self, query):
        vectorstore = None
        loader = WebBaseLoader("http://www.samsuncn.com/cn/about/index.html")
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        )
        splits = text_splitter.split_documents(docs)
        if platform.system() == "Windows":
            from langchain_chroma import Chroma

            vectorstore = Chroma.from_documents(
                documents=splits, embedding=self.embeddings
            )
        elif platform.system() == "Darwin" or platform.system() == "Linux":
            from langchain_community.vectorstores import FAISS

            vectorstore = FAISS.from_documents(
                documents=splits, embedding=self.embeddings
            )
        # vectorstore = Chroma.from_documents(documents=splits, embedding=embedding)
        retriever = vectorstore.as_retriever()
        tool = create_retriever_tool(
            retriever,
            "samsun_search",
            "Search for information about samsun or 三姆森. For any questions about 三姆森, you must use this tool!",
        )

        agent_executor = chat_agent_executor.create_tool_calling_executor(
            self.llm, [tool]
        )
        response = agent_executor.invoke(
            input={"messages": [HumanMessage(content=query)]},
        )
        return response


def create_aimessage_for_call_tool(state, tool):
    human_input = state["messages"][-1].content
    return {
        "messages": [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": tool[0].name,
                        "args": {
                            "query": human_input,
                        },
                        "id": "tool_abcd123",
                    }
                ],
            )
        ]
    }


def call_tool(state, tool):
    messages = state["messages"]
    # Based on the continue condition
    # we know the last message involves a function call
    last_message = messages[-1]
    # We construct an ToolInvocation for each tool call
    tool_invocations = []

    tool_executor = ToolExecutor(tool)

    for tool_call in last_message.tool_calls:
        action = ToolInvocation(
            tool=tool_call["name"],
            tool_input=tool_call["args"],
        )
        tool_invocations.append(action)
    # We call the tool_executor and get back a response
    responses = tool_executor.batch(tool_invocations, return_exceptions=True)
    # We use the response to create tool messages
    tool_messages = [
        ToolMessage(
            content=str(response),
            name=tc["name"],
            tool_call_id=tc["id"],
        )
        for tc, response in zip(last_message.tool_calls, responses)
    ]

    # We return a list, because this will get added to the existing list
    return {"messages": tool_messages}


if __name__ == "__main__":
    from langchain_community.tools.tavily_search import TavilySearchResults
    import os

    os.environ["TAVILY_API_KEY"] = "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"
    tools = [TavilySearchResults(max_results=1)]
    state = {
        "messages": [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "tavily_search_results_json",
                        "args": {
                            "query": "东莞今天的天气",
                        },
                        "id": "tool_abcd123",
                    }
                ],
            )
        ]
    }
    res = call_tool(state, tools=tools)
    print(res)
