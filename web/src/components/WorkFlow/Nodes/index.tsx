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
import ClassifierNode from "./Classifier/ClassifierNode";
import CodeNode from "./Code/CodeNode";
import IfElseNode from "./IfElse/IfElseNode";
import HumanNode from "./Human/HumanNode";
import SubgraphNode from "./Subgraph/SubgraphNode";
import ParameterExtractorNode from "./ParameterExtractor/ParameterExtractorNode";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  llm: LLMNode,
  tool: ToolNode,
  retrieval: RetrievalNode,
  toolretrieval: RetrievalToolNode,
  plugin: PluginNode,
  crewai: CrewAINode,
  classifier: ClassifierNode,
  answer: AnswerNode,
  code: CodeNode,
  ifelse: IfElseNode,
  human: HumanNode,
  subgraph: SubgraphNode,
  parameterExtractor: ParameterExtractorNode,
};
