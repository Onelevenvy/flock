import type { NamedExoticComponent } from "react";
import type { NodeProps } from "reactflow";

import AnswerNode from "./Answer/AnswerNode";
import EndNode from "./End/EndNode";
import LLMNode from "./LLM/LLMNode";
import { type NodeType, nodeConfig } from "./nodeConfig";
import PluginNode from "./Plugin/PluginNode";
import RetrievalNode from "./Retrieval/RetrievalNode";
import RetrievalToolNode from "./RetrievalTool/RetrievalToolNode";
import StartNode from "./Start/StartNode";
import ToolNode from "./Tool/ToolNode";

const nodeComponents: Record<NodeType, NamedExoticComponent<NodeProps>> = {
  start: StartNode,
  end: EndNode,
  llm: LLMNode,
  tool: ToolNode,
  plugin: PluginNode,
  answer: AnswerNode,
  retrieval: RetrievalNode,
  toolretrieval: RetrievalToolNode,
};

export const nodeTypes = Object.fromEntries(
  Object.keys(nodeConfig).map((key) => [key, nodeComponents[key as NodeType]])
) as Record<NodeType, NamedExoticComponent<NodeProps>>;
