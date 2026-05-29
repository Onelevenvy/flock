import { useState, useCallback, useRef } from 'react';
import type { Node } from 'reactflow';
import { Box } from '@mantine/core';
import { WorkflowExecutionMessage } from '../../../../store/workflowStore';
import { useWorkflowChatExecution } from '../../../../hooks/useWorkflowChatExecution';
import { ExecutionPanel } from '../../../Workflow/components/ExecutionPanel';

interface WorkflowChatPanelProps {
  workflowId: string;
  workflowName: string;
  threadId: string;
  /** 初始 query（首页带过来的第一条消息） */
  initialQuery?: string;
  /** 工作流定义中的 start 节点变量（用于初始参数表单） */
  startVariables?: any[];
  /** ReactFlow nodes 用于解析友好名称（可以是空数组，名称降级到类型名） */
  nodes?: Node[];
}

export function WorkflowChatPanel({
  workflowId,
  workflowName,
  threadId,
  initialQuery,
  startVariables,
  nodes = [],
}: WorkflowChatPanelProps) {
  // 本地执行状态
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [messages, setMessages] = useState<WorkflowExecutionMessage[]>([]);
  const [activeInterrupt, setActiveInterrupt] = useState<unknown>(null);

  const appendMessage = useCallback((msg: WorkflowExecutionMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { startWorkflow, resumeWorkflow, stopWorkflow } = useWorkflowChatExecution({
    workflowId,
    threadId,
    onMessage: appendMessage,
    onStatusChange: setStatus,
    onInterrupt: setActiveInterrupt,
  });

  const handleClearExecution = useCallback(() => {
    setMessages([]);
    setStatus('idle');
    setActiveInterrupt(null);
  }, []);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <ExecutionPanel
        status={status}
        messages={messages}
        startWorkflow={startWorkflow}
        stopWorkflow={stopWorkflow}
        resumeWorkflow={resumeWorkflow}
        isEmbedded
        externalNodes={nodes}
        externalStartVariables={startVariables}
        initialQuery={initialQuery}
        workflowName={workflowName}
        activeInterrupt={activeInterrupt}
        onClearExecution={handleClearExecution}
      />
    </Box>
  );
}
