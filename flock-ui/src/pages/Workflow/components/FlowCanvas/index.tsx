import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
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
import { nodeConfig, type NodeType } from '../../nodeConfig';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { useUpdateWorkflow, type WorkflowRecord } from '../../../../hooks/useWorkflow';
import { NodePalette } from '../NodePalette';
import { CustomStepEdge } from '../CustomStepEdge';
import { PropertiesPanel } from '../PropertiesPanel';
import { ExecutionPanel } from '../ExecutionPanel';
import { useWorkflowExecution } from '../../../../hooks/useWorkflowExecution';

import { useFlowLayout } from './hooks/useFlowLayout';
import { LeftToolbar } from './components/LeftToolbar';
import { EdgeInsertMenu } from './components/EdgeInsertMenu';

interface FlowCanvasProps {
  workflowId: string;
  workflowData: WorkflowRecord;
  onBack: () => void;
}

export function FlowCanvas({ workflowId, workflowData, onBack }: FlowCanvasProps) {
  const { t } = useTranslation();
  const { screenToFlowPosition, fitView } = useReactFlow();
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

  // ── Topological Auto Layout Hook ─────────────────────────────────────────
  const { layoutAllNodes } = useFlowLayout(nodes, edges, setNodes, setEdges);

  // ── Active execution node tracking & glow effect ─────────────────────────
  const activeNodeId = useMemo(() => {
    if (executionStatus !== 'running') return null;
    for (let i = executionMessages.length - 1; i >= 0; i--) {
      if (executionMessages[i].nodeId) return executionMessages[i].nodeId;
    }
    return null;
  }, [executionMessages, executionStatus]);

  useEffect(() => {
    // 移除旧高亮
    document.querySelectorAll('.flock-active-node').forEach(el => {
      el.classList.remove('flock-active-node');
    });
    // 添加新高亮
    if (activeNodeId) {
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${activeNodeId}"]`);
      if (nodeEl) {
        nodeEl.classList.add('flock-active-node');
      }
    }
  }, [activeNodeId]);

  // ── Edge Click Node Insertion ─────────────────────────────────────────────
  const [menuEdge, setMenuEdge] = useState<Edge | null>(null);
  const [activeSourceHandle, setActiveSourceHandle] = useState<{ nodeId: string; handleId: string } | null>(null);
  const [insertMode, setInsertMode] = useState<'center' | 'source' | null>(null);
  const [menuPortalPosition, setMenuPortalPosition] = useState<{ x: number; y: number } | null>(null);

  const handleInsertNode = useCallback((type: NodeType) => {
    if (!insertMode) return;

    const sameTypeCount = nodes.filter((n) => n.type === type).length;
    const newNodeId = `${type}-${Date.now()}`;

    if (insertMode === 'center') {
      if (!menuEdge) return;
      const sourceNode = nodes.find(n => n.id === menuEdge.source);
      const targetNode = nodes.find(n => n.id === menuEdge.target);
      if (!sourceNode || !targetNode) return;

      // 计算位置：中点
      const position = {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      };

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
        },
      };

      const newEdge1 = {
        id: `e-${menuEdge.source}-${newNodeId}`,
        source: menuEdge.source,
        sourceHandle: menuEdge.sourceHandle,
        target: newNodeId,
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
        type: 'customStep',
      };
      
      const newEdge2 = {
        id: `e-${newNodeId}-${menuEdge.target}`,
        source: newNodeId,
        sourceHandle: 'right',
        target: menuEdge.target,
        targetHandle: menuEdge.targetHandle,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
        type: 'customStep',
      };

      const nextNodes = [...nodes, newNode];
      const nextEdges = [...edges.filter(e => e.id !== menuEdge.id), newEdge1, newEdge2];

      layoutAllNodes(nextNodes, nextEdges);
    } else {
      // 端点分叉模式
      const sourceNodeId = activeSourceHandle ? activeSourceHandle.nodeId : menuEdge?.source;
      const sourceHandleId = activeSourceHandle ? activeSourceHandle.handleId : menuEdge?.sourceHandle || 'right';

      if (!sourceNodeId) return;
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return;

      // 新建新节点，源节点连到新节点，保留原连线不变
      const position = {
        x: sourceNode.position.x + 280,
        y: sourceNode.position.y + 120, // 稍微向下偏以作分叉
      };

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
        },
      };

      const newEdge = {
        id: `e-${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        sourceHandle: sourceHandleId,
        target: newNodeId,
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
        type: 'customStep',
      };

      const nextNodes = [...nodes, newNode];
      const nextEdges = [...edges, newEdge];

      layoutAllNodes(nextNodes, nextEdges);
    }

    setMenuEdge(null);
    setActiveSourceHandle(null);
    setInsertMode(null);
    setMenuPortalPosition(null);
  }, [menuEdge, activeSourceHandle, insertMode, nodes, edges, layoutAllNodes]);


  // ── ReactFlow event handlers ──────────────────────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
            type: 'customStep',
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
      const src = nodes.find((n) => n.id === connection.source);
      const tgt = nodes.find((n) => n.id === connection.target);
      if (!src || !tgt) return false;

      const srcCfg = nodeConfig[src.type as NodeType];
      const tgtCfg = nodeConfig[tgt.type as NodeType];
      if (!srcCfg || !tgtCfg) return true;

      if (src.type === 'classifier' || src.type === 'ifelse') {
        return tgtCfg.allowedConnections.targets.length > 0;
      }
      const srcOk = !connection.sourceHandle || srcCfg.allowedConnections.sources.includes(connection.sourceHandle);
      const tgtOk = !connection.targetHandle || tgtCfg.allowedConnections.targets.includes(connection.targetHandle);
      return srcOk && tgtOk;
    },
    [nodes]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setShowNodePalette(false);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setShowNodePalette(false);
  }, [setSelectedNodeId]);

  // ── Add Node via Click / Drop ─────────────────────────────────────────────

  const handleAddNode = useCallback(
    (type: NodeType) => {
      if (!nodeConfig[type]) return;

      let position = { x: 250, y: 200 };
      try {
        position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      } catch (err) {
        console.error("Failed to project node position", err);
      }

      const sameTypeCount = nodes.filter((n) => n.type === type).length;
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setShowNodePalette(false);
    },
    [nodes, setNodes, screenToFlowPosition]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/workflow-node') as NodeType;
      if (!type || !nodeConfig[type]) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const sameTypeCount = nodes.filter((n) => n.type === type).length;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setShowNodePalette(false);
    },
    [nodes, setNodes, screenToFlowPosition]
  );

  // ── Save ──────────────────────────────────────────────────────────────────

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

  // ── Selected node ─────────────────────────────────────────────────────────

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
  }, [nodes]);

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
  }, [edges]);

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
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onBack}
            size="sm"
          >
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
        onClose={() => {
          setMenuEdge(null);
          setActiveSourceHandle(null);
          setInsertMode(null);
          setMenuPortalPosition(null);
        }}
        onAddNode={handleInsertNode}
      />

    </Box>
  );
}
