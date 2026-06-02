/**
 * WorkflowEditor — outer shell
 *
 * Responsibilities:
 * 1. Load workflow data from DB
 * 2. Initialize the Zustand store with the saved canvas state
 * 3. Wrap the inner FlowCanvas in <ReactFlowProvider> so that
 *    useReactFlow() / screenToFlowPosition() work correctly
 */
import { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Box, Loader } from '@mantine/core';
import { useWorkflowQuery } from '@/hooks/useWorkflow';
import { useWorkflowStore } from '@/store/workflowStore';
import { FlowCanvas } from './FlowCanvas';

interface WorkflowEditorProps {
  workflowId: string;
  onBack: () => void;
}

export function WorkflowEditor({ workflowId, onBack }: WorkflowEditorProps) {
  const { data: workflowData, isLoading } = useWorkflowQuery(workflowId);
  const { loadWorkflowConfig, setActiveWorkflowId } = useWorkflowStore();
  const [ready, setReady] = useState(false);

  // Set active ID and handle unmount cleanup
  useEffect(() => {
    setActiveWorkflowId(workflowId);
    return () => {
      setReady(false);
      setActiveWorkflowId(null);
    };
  }, [workflowId, setActiveWorkflowId]);

  // Seed the canvas store from DB when data is loaded
  useEffect(() => {
    if (workflowData && !ready) {
      loadWorkflowConfig(workflowData.config);
      setReady(true);
    }
  }, [workflowData, loadWorkflowConfig, ready]);

  if (isLoading || !workflowData || !ready) {
    return (
      <Box
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--flock-bg-base)',
          borderRadius: 16,
          border: '1px solid var(--flock-border-subtle)',
        }}
      >
        <Loader size="sm" color="blue" />
      </Box>
    );
  }

  return (
    // ReactFlowProvider must wrap FlowCanvas so that useReactFlow() works
    <ReactFlowProvider>
      <FlowCanvas workflowId={workflowId} workflowData={workflowData} onBack={onBack} />
    </ReactFlowProvider>
  );
}
