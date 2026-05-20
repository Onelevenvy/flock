import { useState } from 'react';
import { useWorkflowStore } from '../../store/workflowStore';
import { WorkflowListPage } from './WorkflowListPage';
import { WorkflowEditor } from './WorkflowEditor';

export function WorkflowPage() {
  const { activeWorkflowId, setActiveWorkflowId } = useWorkflowStore();
  const [editingId, setEditingId] = useState<string | null>(activeWorkflowId);

  const handleOpenEditor = (id: string) => {
    setEditingId(id);
    setActiveWorkflowId(id);
  };

  const handleBack = () => {
    setEditingId(null);
    setActiveWorkflowId(null);
  };

  if (editingId) {
    return <WorkflowEditor workflowId={editingId} onBack={handleBack} />;
  }

  return <WorkflowListPage onOpenEditor={handleOpenEditor} />;
}
