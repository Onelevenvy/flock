import { NodeTypes } from "reactflow";

import AnswerNode from "./Answer/AnswerNode";
import CrewAINode from "./CrewAI/CrewAINode";
import EndNode from "./End/EndNode";
import LLMNode from "./LLM/LLMNode";
import PluginNode from "./Plugin/PluginNode";
import RetrievalNode from "./Retrieval/RetrievalNode";
import RetrievalToolNode from "./RetrievalTool/RetrievalToolNode";
import StartNode from "./Start/StartNode";
import ToolNode from "./Tool/ToolNode";

// 导出所有节点类型
export * from "./Answer/AnswerNode";
export * from "./CrewAI/CrewAINode";
export * from "./End/EndNode";
export * from "./LLM/LLMNode";
export * from "./Plugin/PluginNode";
export * from "./Retrieval/RetrievalNode";
export * from "./RetrievalTool/RetrievalToolNode";
export * from "./Start/StartNode";
export * from "./Tool/ToolNode";

// 导出所有节点属性组件
export * from "./Answer/AnswerNodeProperties";
export * from "./CrewAI/CrewAINodeProperties";
export * from "./End/EndNodeProperties";
export * from "./LLM/LLMNodeProperties";
export * from "./Plugin/PluginNodeProperties";
export * from "./Retrieval/RetrievalNodeProperties";
export * from "./RetrievalTool/RetrievalToolNodeProperties";
export * from "./Start/StartNodeProperties";
export * from "./Tool/ToolNodeProperties";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  llm: LLMNode,
  tool: ToolNode,
  answer: AnswerNode,
  retrieval: RetrievalNode,
  toolretrieval: RetrievalToolNode,
  plugin: PluginNode,
  crewai: CrewAINode,
};
