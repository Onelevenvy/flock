import React, { memo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseWorkflowNode } from './BaseWorkflowNode';
import { type BaseNodeData } from './types';

export const LLMNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="llm" />);
export const AgentNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="agent" />);
export const AnswerNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="answer" />);
export const CodeNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="code" />);
export const HumanNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="human" />);
export const ParameterExtractorNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="parameterExtractor" />);
export const PluginNode = memo((props: NodeProps<BaseNodeData>) => <BaseWorkflowNode {...props} type="plugin" />);
