import type { Node } from 'reactflow';
import { useWorkflowRuntime } from '@/hooks/useWorkflowRuntime';
import { ExecutionPanel } from './ExecutionPanel';

interface WorkflowChatPanelProps {
  workflowId: string;
  workflowName: string;
  threadId: string;
  initialQuery?: string;
  startVariables?: unknown[];
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
  const {
    messages,
    status,
    activeInterrupt,
    startWorkflow,
    resumeWorkflow,
    stopWorkflow,
    clearExecution,
  } = useWorkflowRuntime({
    workflowId,
    threadId,
    isDebug: false,
  });

  return (
    <ExecutionPanel
      status={status}
      messages={messages}
      startWorkflow={startWorkflow}
      stopWorkflow={stopWorkflow}
      resumeWorkflow={resumeWorkflow}
      isEmbedded={true}
      externalNodes={nodes}
      externalStartVariables={startVariables}
      initialQuery={initialQuery}
      workflowName={workflowName}
      activeInterrupt={activeInterrupt}
      onClearExecution={clearExecution}
    />
  );
}
