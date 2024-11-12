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
