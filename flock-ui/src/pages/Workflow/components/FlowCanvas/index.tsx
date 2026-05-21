import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  type Edge,
  type Node,
  MarkerType,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Group, Button, ActionIcon, Tooltip, Divider, ThemeIcon, Badge, Text, Transition } from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconRoute,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { workflowNodeTypes } from '../../nodes/nodeTypesMap';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { useUpdateWorkflow, type WorkflowRecord } from '../../../../hooks/useWorkflow';
import { NodePalette } from '../NodePalette';
import { CustomStepEdge } from '../CustomStepEdge';
import { PropertiesPanel } from '../PropertiesPanel';
import { ExecutionPanel } from '../ExecutionPanel';
import { useWorkflowExecution } from '../../../../hooks/useWorkflowExecution';

import { useFlowLayout } from './hooks/useFlowLayout';
import { useNodeInsertion } from './hooks/useNodeInsertion';
import { useFlowHandlers } from './hooks/useFlowHandlers';
import { useDropHandler } from './hooks/useDropHandler';
import { LeftToolbar } from './components/LeftToolbar';
import { EdgeInsertMenu } from './components/EdgeInsertMenu';

interface FlowCanvasProps {
  workflowId: string;
  workflowData: WorkflowRecord;
  onBack: () => void;
}

export function FlowCanvas({ workflowId, workflowData, onBack }: FlowCanvasProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const updateMutation = useUpdateWorkflow();

  const {
    nodes,
    edges,
    isDirty,
    selectedNodeId,
    setNodes,
    setEdges,
    setDirty,
    setSelectedNodeId,
    updateNodeData,
    executionStatus,
    executionMessages,
  } = useWorkflowStore();

  const { startWorkflow, resumeWorkflow, stopWorkflow } = useWorkflowExecution();

  const [showExecution, setShowExecution] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);

  // ── Topological Auto Layout Hook ───────────────────────────────────────
  const { layoutAllNodes } = useFlowLayout(nodes, edges, setNodes, setEdges);

  // ── Active execution node tracking & glow effect ────────────────────────
  const activeNodeId = useMemo(() => {
    if (executionStatus !== 'running') return null;
    for (let i = executionMessages.length - 1; i >= 0; i--) {
      if (executionMessages[i].nodeId) return executionMessages[i].nodeId;
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

  // ── Node Insertion (edge-click) ─────────────────────────────────────────
  const {
    menuEdge,
    setMenuEdge,
    activeSourceHandle,
    setActiveSourceHandle,
    insertMode,
    setInsertMode,
    menuPortalPosition,
    setMenuPortalPosition,
    handleInsertNode,
    closeMenu,
  } = useNodeInsertion(nodes, edges, layoutAllNodes);

  // ── Standard ReactFlow handlers ─────────────────────────────────────────
  const { onNodesChange, onEdgesChange, onConnect, isValidConnection, onNodeClick, onPaneClick } =
    useFlowHandlers(nodes, setNodes, edges, setEdges, setSelectedNodeId, setShowNodePalette);

  // ── Add node via click/drop ─────────────────────────────────────────────
  const { handleAddNode, onDragOver, onDrop } = useDropHandler(nodes, setNodes, setShowNodePalette);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    await updateMutation.mutateAsync({
      id: workflowId,
      input: {
        name: workflowData.name,
        description: workflowData.description,
        is_active: workflowData.is_active,
        config: { nodes, edges, metadata: workflowData.config.metadata ?? {} },
      },
    });
    setDirty(false);
  }, [workflowId, workflowData, nodes, edges, updateMutation, setDirty]);

  // ── Selected node ───────────────────────────────────────────────────────
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onHandlePlusClick: (nodeId: string, handleId: string, clientX: number, clientY: number) => {
          setActiveSourceHandle({ nodeId, handleId });
          setInsertMode('source');
          setMenuPortalPosition({ x: clientX, y: clientY });
        }
      }
    }));
  }, [nodes, setActiveSourceHandle, setInsertMode, setMenuPortalPosition]);

  const edgeTypes = useMemo(() => ({ customStep: CustomStepEdge }), []);

  const edgesWithCallbacks = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      type: 'customStep',
      data: {
        ...edge.data,
        onInsertClick: (mode: 'center' | 'source', x: number, y: number) => {
          setMenuEdge(edge);
          setInsertMode(mode);
          setMenuPortalPosition({ x, y });
        }
      }
    }));
  }, [edges, setMenuEdge, setInsertMode, setMenuPortalPosition]);

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: 'var(--flock-bg-base)',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Group
        px="md"
        py="xs"
        justify="space-between"
        style={{
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
          flexShrink: 0,
          minHeight: 48,
        }}
      >
        <Group gap="sm">
          <ActionIcon variant="subtle" color="gray" onClick={onBack} size="sm">
            <IconArrowLeft size={16} />
          </ActionIcon>
          <ThemeIcon
            size={28}
            radius="md"
            style={{ background: 'var(--flock-accent)', boxShadow: '0 2px 8px rgba(21,90,239,0.2)' }}
          >
            <IconRoute size={14} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)', lineHeight: 1.2 }}>
              {workflowData.name}
            </Text>
            {isDirty && (
              <Badge size="xs" variant="dot" color="orange" style={{ fontSize: 9 }}>
                {t('workflow.unsaved')}
              </Badge>
            )}
          </Box>
        </Group>

        <Group gap="xs">
          <Tooltip label={t('workflow.debug')} withArrow openDelay={300}>
            <ActionIcon
              variant={showExecution ? 'filled' : 'subtle'}
              color={showExecution ? 'teal' : 'gray'}
              size="sm"
              onClick={() => setShowExecution((v) => !v)}
            >
              <IconPlayerPlay size={15} />
            </ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Button
            size="xs"
            leftSection={<IconDeviceFloppy size={13} />}
            loading={updateMutation.isPending}
            onClick={handleSave}
            disabled={!isDirty}
            style={
              isDirty
                ? { background: 'var(--flock-accent)', boxShadow: '0 2px 8px rgba(21,90,239,0.2)' }
                : undefined
            }
            color="blue"
          >
            {t('common.save')}
          </Button>
        </Group>
      </Group>

      {/* ── Canvas area ─────────────────────────────────────────────────── */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box style={{ flex: 1, position: 'relative' }}>
          {/* ── Left Floating Toolbar ── */}
          <LeftToolbar
            showNodePalette={showNodePalette}
            setShowNodePalette={setShowNodePalette}
            isPanMode={isPanMode}
            setIsPanMode={setIsPanMode}
            layoutAllNodes={layoutAllNodes}
            fitView={fitView}
            showMinimap={showMinimap}
            setShowMinimap={setShowMinimap}
            t={t}
          />

          {/* ── Node Palette Popover ── */}
          <Transition mounted={showNodePalette} transition="slide-right" duration={200} timingFunction="ease">
            {(styles) => (
              <Box
                style={{
                  position: 'absolute',
                  left: 68,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 99,
                }}
              >
                <Box style={styles}>
                  <NodePalette onAddNode={handleAddNode} />
                </Box>
              </Box>
            )}
          </Transition>

          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edgesWithCallbacks}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={workflowNodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            deleteKeyCode={['Backspace', 'Delete']}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            panOnDrag={isPanMode}
            defaultEdgeOptions={{
              type: 'customStep',
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
              interactionWidth: 20,
            }}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            style={{ background: 'var(--flock-bg-base)' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.2}
              color="var(--flock-border-dim)"
            />
            {showMinimap && (
              <MiniMap
                style={{
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  borderRadius: 8,
                }}
                maskColor="rgba(0,0,0,0.06)"
              />
            )}
          </ReactFlow>
        </Box>

        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onDataChange={updateNodeData}
          />
        )}

        {showExecution && (
          <ExecutionPanel
            status={executionStatus}
            messages={executionMessages}
            onClose={() => setShowExecution(false)}
            startWorkflow={async (input) => {
              if (isDirty) {
                await handleSave();
              }
              await startWorkflow(input);
            }}
            stopWorkflow={stopWorkflow}
            resumeWorkflow={resumeWorkflow}
          />
        )}
      </Box>

      {/* ── Edge click insertion floating Portal Menu ─────────────────── */}
      <EdgeInsertMenu
        menuPortalPosition={menuPortalPosition}
        onClose={closeMenu}
        onAddNode={handleInsertNode}
      />
    </Box>
  );
}
