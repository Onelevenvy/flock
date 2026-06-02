import React, { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseBranchWorkflowNode, type WorkflowNodeBranch } from '../BaseBranchWorkflowNode';
import { type BaseNodeData } from '../types';

export const IfElseNode = memo((props: NodeProps<BaseNodeData>) => {
  const { data } = props;
  const cases = (data.cases as { case_id: string }[]) ?? [];

  // 将 IfElse 条件分支数据转换为底座标准的分支结构
  const branches = useMemo<WorkflowNodeBranch[]>(() => {
    return cases.map((c, idx) => {
      const isElse = c.case_id === 'false_else';
      return {
        id: c.case_id,
        title: isElse ? 'ELSE' : `IF ${idx + 1}`,
      };
    });
  }, [cases]);

  return <BaseBranchWorkflowNode {...props} type="ifelse" branches={branches} />;
});

IfElseNode.displayName = 'IfElseNode';
