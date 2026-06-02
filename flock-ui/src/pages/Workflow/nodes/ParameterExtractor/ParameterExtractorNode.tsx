import React, { memo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseWorkflowNode } from '../BaseWorkflowNode';
import { type BaseNodeData } from '../types';

export const ParameterExtractorNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="parameterExtractor" />
));
ParameterExtractorNode.displayName = 'ParameterExtractorNode';
