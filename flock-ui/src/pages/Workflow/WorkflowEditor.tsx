import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Text,
  Group,
  Button,
  ActionIcon,
  Tooltip,
  Divider,
  ThemeIcon,
  Badge,
  Loader,
  ScrollArea,
  Stack,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconPlayerStop,
  IconLayoutGrid,
  IconX,
  IconRoute,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { workflowNodeTypes } from './WorkflowNodes';
import { nodeConfig, type NodeType } from './nodeConfig';
import { useWorkflowStore } from '../../store/workflowStore';
import { useWorkflowQuery, useUpdateWorkflow } from '../../hooks/useWorkflow';
import { NodePalette } from './NodePalette';
import { PropertiesPanel } from './PropertiesPanel';

interface WorkflowEditorProps {
  workflowId: string;
  onBack: () => void;
}

export function WorkflowEditor({ workflowId, onBack }: WorkflowEditorProps) {
  const { t } = useTranslation();
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
    loadWorkflowConfig,
    updateNodeData,
    executionStatus,
    executionMessages,
  } = useWorkflowStore();

  const [showExecution, setShowExecution] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

  // Load workflow from DB on mount
  const { data: workflowData, isLoading } = useWorkflowQuery(workflowId);

  // When data arrives, load into store (only once)
  const [initialized, setInitialized] = useState(false);
  if (workflowData && !initialized) {
    loadWorkflowConfig(workflowData.config as Parameters<typeof loadWorkflowConfig>[0]);
    setInitialized(true);
  }

  // ── ReactFlow handlers ────────────────────────────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
            style: { strokeWidth: 2 },
            type: 'smoothstep',
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return false;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const srcType = sourceNode.type as NodeType;
      const tgtType = targetNode.type as NodeType;
      const srcCfg = nodeConfig[srcType];
      const tgtCfg = nodeConfig[tgtType];
      if (!srcCfg || !tgtCfg) return true;

      // For classifier/ifelse, source handles are category IDs → allow
      if (srcType === 'classifier' || srcType === 'ifelse') {
        return tgtCfg.allowedConnections.targets.length > 0;
      }

      const srcOk =
        !connection.sourceHandle ||
        srcCfg.allowedConnections.sources.includes(connection.sourceHandle);
      const tgtOk =
        !connection.targetHandle ||
        tgtCfg.allowedConnections.targets.includes(connection.targetHandle);
      return srcOk && tgtOk;
    },
    [nodes]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // ── Drag-and-drop from palette ────────────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/workflow-node') as NodeType;
      if (!type || !nodeConfig[type]) return;

      const bounds = (event.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 25,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${nodes.filter((n) => n.type === type).length + 1}`,
          ...nodeConfig[type].initialData,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes]
  );

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!workflowData) return;
    await updateMutation.mutateAsync({
      id: workflowId,
      input: {
        name: workflowData.name,
        description: workflowData.description,
        is_active: workflowData.is_active,
        config: { nodes, edges, metadata: workflowData.config?.metadata ?? {} },
      },
    });
    setDirty(false);
  }, [workflowId, workflowData, nodes, edges, updateMutation, setDirty]);

  // ── Selected node ─────────────────────────────────────────────────────────

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  if (isLoading) {
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
        <Loader size="md" />
      </Box>
    );
  }

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
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      }}
    >
      {/* ── Toolbar ── */}
      <Group
        px="md"
        py="xs"
        justify="space-between"
        style={{
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
          flexShrink: 0,
        }}
      >
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={onBack}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <ThemeIcon size={28} radius="md" style={{ background: 'var(--flock-accent)' }}>
            <IconRoute size={14} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)', lineHeight: 1.2 }}>
              {workflowData?.name ?? '...'}
            </Text>
            {isDirty && (
              <Badge size="xs" variant="dot" color="orange">
                {t('workflow.unsaved')}
              </Badge>
            )}
          </Box>
        </Group>

        <Group gap="xs">
          <Tooltip label={t('workflow.minimap')}>
            <ActionIcon
              variant={showMinimap ? 'filled' : 'subtle'}
              color="blue"
              onClick={() => setShowMinimap(!showMinimap)}
            >
              <IconLayoutGrid size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('workflow.debug')}>
            <ActionIcon
              variant={showExecution ? 'filled' : 'subtle'}
              color="teal"
              onClick={() => setShowExecution(!showExecution)}
            >
              <IconPlayerPlay size={16} />
            </ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Button
            size="xs"
            leftSection={<IconDeviceFloppy size={14} />}
            loading={updateMutation.isPending}
            onClick={handleSave}
            disabled={!isDirty}
            style={{ background: isDirty ? 'var(--flock-accent)' : undefined }}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Group>

      {/* ── Main canvas area ── */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Node palette */}
        <NodePalette />

        {/* ReactFlow canvas */}
        <Box style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={workflowNodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
              },
              style: { strokeWidth: 2 },
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: 'var(--flock-bg-base)' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--flock-border-subtle)"
            />
            <Controls
              style={{
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-subtle)',
                borderRadius: 8,
              }}
            />
            {showMinimap && (
              <MiniMap
                style={{
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-subtle)',
                  borderRadius: 8,
                }}
              />
            )}
          </ReactFlow>
        </Box>

        {/* Properties panel (right side) */}
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onDataChange={updateNodeData}
          />
        )}
      </Box>

      {/* ── Debug execution panel (bottom slide-in) ── */}
      {showExecution && (
        <ExecutionPanel
          status={executionStatus}
          messages={executionMessages}
          onClose={() => setShowExecution(false)}
          workflowId={workflowId}
        />
      )}
    </Box>
  );
}

// ── Execution Debug Panel ─────────────────────────────────────────────────

interface ExecutionPanelProps {
  status: 'idle' | 'running' | 'done' | 'error';
  messages: { type: string; content: string; timestamp: number }[];
  onClose: () => void;
  workflowId: string;
}

function ExecutionPanel({ status, messages, onClose }: ExecutionPanelProps) {
  const { t } = useTranslation();
  const [showPanel, setShowPanel] = useState(true);

  return (
    <Box
      style={{
        borderTop: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        height: showPanel ? 240 : 40,
        transition: 'height 0.2s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Panel header */}
      <Group
        px="md"
        py={6}
        justify="space-between"
        style={{
          borderBottom: showPanel ? '1px solid var(--flock-border-subtle)' : 'none',
          flexShrink: 0,
        }}
      >
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => setShowPanel(!showPanel)}
          >
            {showPanel ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
          <Text size="xs" fw={600} c="dimmed">
            {t('workflow.execution.title')}
          </Text>
          <Badge
            size="xs"
            color={
              status === 'running'
                ? 'blue'
                : status === 'done'
                ? 'teal'
                : status === 'error'
                ? 'red'
                : 'gray'
            }
            variant="light"
          >
            {status === 'idle'
              ? t('workflow.execution.idle')
              : status === 'running'
              ? t('workflow.execution.running')
              : status === 'done'
              ? t('workflow.execution.done')
              : t('workflow.execution.error')}
          </Badge>
        </Group>
        <ActionIcon variant="subtle" size="xs" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>

      {showPanel && (
        <ScrollArea style={{ flex: 1 }} p="xs">
          <Stack gap={4}>
            {messages.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="sm">
                {t('workflow.execution.noOutput')}
              </Text>
            ) : (
              messages.map((msg, i) => (
                <Box
                  key={i}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color:
                      msg.type === 'error'
                        ? 'var(--mantine-color-red-5)'
                        : 'var(--flock-text-primary)',
                    lineHeight: 1.6,
                    padding: '2px 0',
                  }}
                >
                  {msg.content}
                </Box>
              ))
            )}
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
