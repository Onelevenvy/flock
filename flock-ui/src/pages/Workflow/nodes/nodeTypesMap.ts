import { StartNode } from './Start/StartNode';
import { EndNode } from './End/EndNode';
import { LLMNode } from './LLM/LLMNode';
import { AgentNode } from './Agent/AgentNode';
import { ClassifierNode } from './Classifier/ClassifierNode';
import { IfElseNode } from './IfElse/IfElseNode';
import { AnswerNode } from './Answer/AnswerNode';
import { CodeNode } from './Code/CodeNode';
import { HumanNode } from './Human/HumanNode';
import { ParameterExtractorNode } from './ParameterExtractor/ParameterExtractorNode';
import { PluginNode } from './Plugin/PluginNode';

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

