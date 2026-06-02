import React, { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { BaseBranchWorkflowNode, type WorkflowNodeBranch } from '../BaseBranchWorkflowNode';
import { type BaseNodeData } from '../types';

export interface HumanAction {
  key: string;
  label: string;
  enable_feedback?: boolean;
}

export const HumanNode = memo((props: NodeProps<BaseNodeData>) => {
  const { data } = props;
  const { t } = useTranslation();
  
  const actions = (data.user_actions as HumanAction[]) ?? [
    { key: 'action_1', label: 'Approve' },
    { key: 'action_2', label: 'Reject' },
  ];

  // 将人机交互的分支按钮（以及超时分支）转换为底座标准的分支结构
  const branches = useMemo<WorkflowNodeBranch[]>(() => {
    const regularBranches = actions.map((act) => ({
      id: act.key,
      title: act.key.toUpperCase(),
      subtitle: act.label,
    }));

    const timeoutBranch = {
      id: 'TIMEOUT',
      title: 'TIMEOUT',
      subtitle: t('workflow.properties.human.timeoutAction', 'TIMEOUT'),
      titleColor: 'var(--mantine-color-red-6)', // 红色高亮
    };

    return [...regularBranches, timeoutBranch];
  }, [actions, t]);

  return <BaseBranchWorkflowNode {...props} type="human" branches={branches} />;
});

HumanNode.displayName = 'HumanNode';
