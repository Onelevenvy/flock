import { useWorkflowStore } from '@/store/workflowStore';
import { WorkflowListPage } from './components/WorkflowListPage';
import { WorkflowEditor } from './components/WorkflowEditor';

/**
 * WorkflowPage — top-level route entry
 * Switches between the workflow list and the canvas editor.
 */
export function WorkflowPage() {
  const { activeWorkflowId, setActiveWorkflowId } = useWorkflowStore();

  if (activeWorkflowId) {
    return <WorkflowEditor workflowId={activeWorkflowId} onBack={() => setActiveWorkflowId(null)} />;
  }

  return <WorkflowListPage onOpenEditor={setActiveWorkflowId} />;
}
