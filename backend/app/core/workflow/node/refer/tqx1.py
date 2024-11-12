from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import SystemMessage
from typing_extensions import TypedDict, Optional
from typing import Annotated
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from lcgraph.tqx_core.tqx_node import QuestionClassifilerNode
from lcgraph.tqx_core.models import TqxEmbeddings
import platform
from langchain_community.document_loaders import WebBaseLoader
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.tools import create_retriever_tool
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.checkpoint.sqlite import SqliteSaver
import os

DEBUG = False


class TqxState(TypedDict):
    messages: Annotated[list, add_messages]
    ask_human: bool
    question_classification: Optional[str]


cats = [
    "天气查询",
    "三姆森",
    "网络搜索",
    "打招呼",
]


def call_tavily_search(state):
    if DEBUG:
        print("这里是tavily search node: state--", state)
    llm = ChatOpenAI(
        model="glm-4",
        temperature=0.01,
        openai_api_key="cd9ca4dcbf3217e18d1badc374b038eb.bcUZ4vUlbk672SvA",
        openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
    )
    os.environ["TAVILY_API_KEY"] = "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"
    tools = [TavilySearchResults(max_results=1)]
    app = create_react_agent(
        llm, tools, messages_modifier=SystemMessage(content="you must use tools")
    )
    response = app.invoke(
        input={"messages": [state["messages"][-1]]},
    )
    return response


def call_open_weather(state):
    if DEBUG:
        print("这里是open_weather node: state--", state)
    response = [AIMessage(content="The weather is ranny today!")]
    return {"messages": response}


def call_model(state):
    if DEBUG:
        print("这里是chat model node: state--", state)
    llm = ChatOpenAI(
        model="glm-4",
        temperature=0.01,
        openai_api_key="cd9ca4dcbf3217e18d1badc374b038eb.bcUZ4vUlbk672SvA",
        openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
    )
    messages = state["messages"]
    response = llm.invoke(messages)
    # We return a list, because this will get added to the existing list
    return {"messages": [response]}


def call_samsun_info_retriever(state):
    if DEBUG:
        print("这里是samsun_info_retriever node: state--", state)
    llm = ChatOpenAI(
        model="glm-4",
        temperature=0.01,
        openai_api_key="cd9ca4dcbf3217e18d1badc374b038eb.bcUZ4vUlbk672SvA",
        openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
    )
    embedding = TqxEmbeddings()
    vectorstore = None
    loader = WebBaseLoader("http://www.samsuncn.com/cn/about/index.html")
    docs = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    if platform.system() == "Windows":
        from langchain_chroma import Chroma

        vectorstore = Chroma.from_documents(documents=splits, embedding=embedding)
    elif platform.system() == "Darwin" or platform.system() == "Linux":
        from langchain_community.vectorstores import FAISS

        vectorstore = FAISS.from_documents(documents=splits, embedding=embedding)
    # vectorstore = Chroma.from_documents(documents=splits, embedding=embedding)
    retriever = vectorstore.as_retriever()
    tool = create_retriever_tool(
        retriever,
        "samsun_search",
        "Search for information about samsun or 三姆森. For any questions about 三姆森, you must use this tool!",
    )
    tools = [tool]

    app = create_react_agent(
        llm, tools, messages_modifier=SystemMessage(content="you must use tools")
    )
    response = app.invoke(
        input={
            # "messages": [HumanMessage(content=state['messages'][-1])]
            "messages": [state["messages"][-1]]
        },
    )
    return response


def classify_input_node(state):
    llm = ChatOpenAI(
        model="glm-4",
        temperature=0.01,
        openai_api_key="cd9ca4dcbf3217e18d1badc374b038eb.bcUZ4vUlbk672SvA",
        openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
    )
    if DEBUG:
        print("这里是 问题分类器 node state：----", state)
    classification = QuestionClassifilerNode(categories=cats, llm=llm)
    response = classification.invoke(state["messages"][-1])
    state["question_classification"] = response.get("category_name", "model")
    state["ask_human"] = False
    # state['messages'] = HumanMessage(content=state["query"])
    return state


llm = ChatOpenAI(
    model="glm-4",
    temperature=0.01,
    openai_api_key="cd9ca4dcbf3217e18d1badc374b038eb.bcUZ4vUlbk672SvA",
    openai_api_base="https://open.bigmodel.cn/api/paas/v4/",
)

embedding = TqxEmbeddings()

workflow = StateGraph(TqxState)
workflow.add_node("model", call_model)
workflow.add_node("question_cls", classify_input_node)
workflow.add_node("weather_search", call_open_weather)
workflow.add_node("samsun", call_samsun_info_retriever)
workflow.add_node("web_search", call_tavily_search)

workflow.set_entry_point("question_cls")


def decide_next_node(state):
    cls = state.get("question_classification")
    print("问题分类器结果：", cls)
    if state["ask_human"]:
        return "human"
    if DEBUG:
        print("deside next node:", cls)
    if cls in cats:
        return cls
        # return "model"
    else:
        # return "normalchat"
        return "model"


workflow.add_conditional_edges(
    "question_cls",
    decide_next_node,
    {
        "打招呼": "model",
        "三姆森": "samsun",
        "天气查询": "weather_search",
        "网络搜索": "web_search",
        # "网络搜索": "samsun",
        "model": "model",
    },
)

workflow.add_edge("model", END)
workflow.add_edge("samsun", END)
workflow.add_edge("weather_search", END)
workflow.add_edge("web_search", END)


memory = SqliteSaver.from_conn_string(":memory:")
graph = workflow.compile(
    checkpointer=memory,
    # interrupt_before=["human"],
)

if __name__ == "__main__":
    while True:
        config = {"configurable": {"thread_id": "aa11111a1a"}}
        query = input("有什么可以帮您:\n>>>")
        if query.lower() in ["quit", "exit", "q"]:
            break

        # The config is the **second positional argument** to stream() or invoke()!
        events = graph.invoke({"messages": query}, config, stream_mode="values")
        print("envent", events)

        # for event in events:
        #
        #     if "messages" in event:
        #         try:
        #             event["messages"][-1].pretty_print()
        #         except Exception as e:
        #             print(AIMessage(content="AI messages 为空"))
