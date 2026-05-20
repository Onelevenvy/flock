import { useState } from 'react';
import { WorkflowListPage } from './components/WorkflowListPage';
import { WorkflowEditor } from './components/WorkflowEditor';

/**
 * WorkflowPage — top-level route entry
 * Switches between the workflow list and the canvas editor.
 */
export function WorkflowPage() {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (editingId) {
    return <WorkflowEditor workflowId={editingId} onBack={() => setEditingId(null)} />;
  }

  return <WorkflowListPage onOpenEditor={setEditingId} />;
}
