import { StartNode, EndNode } from './StartEndNodes';
import {
  LLMNode,
  AgentNode,
  AnswerNode,
  CodeNode,
  ParameterExtractorNode,
  PluginNode,
} from './StandardNodes';
import { ClassifierNode, IfElseNode, HumanNode } from './MultiHandleNodes';

export const workflowNodeTypes = {
  start: StartNode,
  end: EndNode,
  llm: LLMNode,
  agent: AgentNode,
  classifier: ClassifierNode,
  ifelse: IfElseNode,
  answer: AnswerNode,
  code: CodeNode,
  human: HumanNode,
  parameterExtractor: ParameterExtractorNode,
  plugin: PluginNode,
};
