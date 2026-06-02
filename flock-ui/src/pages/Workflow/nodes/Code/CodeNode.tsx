import React, { memo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseWorkflowNode } from '../BaseWorkflowNode';
import { type BaseNodeData } from '../types';

export const CodeNode = memo((props: NodeProps<BaseNodeData>) => (
  <BaseWorkflowNode {...props} type="code" />
));
CodeNode.displayName = 'CodeNode';
