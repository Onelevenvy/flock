import React, { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseBranchWorkflowNode, type WorkflowNodeBranch } from '../BaseBranchWorkflowNode';
import { type BaseNodeData } from '../types';

export const ClassifierNode = memo((props: NodeProps<BaseNodeData>) => {
  const { data } = props;
  const categories = (data.categories as { category_id: string; category_name: string }[]) ?? [];

  // 将分类数据转换为底座标准的分支结构
  const branches = useMemo<WorkflowNodeBranch[]>(() => {
    let classIdx = 0;
    return categories.map((cat) => {
      const isOthers = cat.category_id === 'others_category';
      return {
        id: cat.category_id,
        title: isOthers ? 'OTHERS' : `CLASS ${++classIdx}`,
        subtitle: isOthers ? undefined : cat.category_name,
      };
    });
  }, [categories]);

  return <BaseBranchWorkflowNode {...props} type="classifier" branches={branches} />;
});

ClassifierNode.displayName = 'ClassifierNode';
