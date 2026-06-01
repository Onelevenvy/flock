import { useMemo, useEffect } from 'react';
import type { WorkflowExecutionMessage } from '@/store/workflowStore';

export function useActiveNodeGlow(
  executionMessages: WorkflowExecutionMessage[],
  executionStatus: string
): string | null {
  const activeNodeId = useMemo(() => {
    if (executionStatus !== 'running') return null;
    for (let i = executionMessages.length - 1; i >= 0; i--) {
      if (executionMessages[i].nodeId) return executionMessages[i].nodeId!;
    }
    return null;
  }, [executionMessages, executionStatus]);

  useEffect(() => {
    document.querySelectorAll('.flock-active-node').forEach(el => {
      el.classList.remove('flock-active-node');
    });
    if (activeNodeId) {
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${activeNodeId}"]`);
      if (nodeEl) {
        nodeEl.classList.add('flock-active-node');
      }
    }
  }, [activeNodeId]);

  return activeNodeId;
}
