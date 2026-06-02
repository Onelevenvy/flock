import { StartNodeProperties } from './Start/StartNodeProperties';
import { LLMNodeProperties } from './LLM/LLMNodeProperties';
import { AgentNodeProperties } from './Agent/AgentNodeProperties';
import { ClassifierNodeProperties } from './Classifier/ClassifierNodeProperties';
import { IfElseNodeProperties } from './IfElse/IfElseNodeProperties';
import { AnswerNodeProperties } from './Answer/AnswerNodeProperties';
import { CodeNodeProperties } from './Code/CodeNodeProperties';
import { HumanNodeProperties } from './Human/HumanNodeProperties';
import { ParameterExtractorNodeProperties } from './ParameterExtractor/ParameterExtractorNodeProperties';
import { PluginNodeProperties } from './Plugin/PluginNodeProperties';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodePropertiesMap: Record<string, React.ComponentType<any>> = {
  start: StartNodeProperties,
  llm: LLMNodeProperties,
  agent: AgentNodeProperties,
  classifier: ClassifierNodeProperties,
  ifelse: IfElseNodeProperties,
  answer: AnswerNodeProperties,
  code: CodeNodeProperties,
  human: HumanNodeProperties,
  parameterExtractor: ParameterExtractorNodeProperties,
  plugin: PluginNodeProperties,
};
