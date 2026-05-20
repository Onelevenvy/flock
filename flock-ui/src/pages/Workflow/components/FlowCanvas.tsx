import { useCallback, useMemo, useState, useEffect } from 'react';
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
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Group, Button, ActionIcon, Tooltip, Divider, ThemeIcon, Badge, Text, Menu, Stack } from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconLayoutGrid,
  IconRoute,
  IconHierarchy,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { workflowNodeTypes } from '../WorkflowNodes';
import { nodeConfig, type NodeType } from '../nodeConfig';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useUpdateWorkflow, type WorkflowRecord } from '../../../hooks/useWorkflow';
import { NodePalette } from './NodePalette';
import { PropertiesPanel } from './PropertiesPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { useWorkflowExecution } from '../../../hooks/useWorkflowExecution';

interface FlowCanvasProps {
  workflowId: string;
  workflowData: WorkflowRecord;
  onBack: () => void;
}

export function FlowCanvas({ workflowId, workflowData, onBack }: FlowCanvasProps) {
  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
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
  const [menuPortalPosition, setMenuPortalPosition] = useState<{ x: number; y: number } | null>(null);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setMenuEdge(edge);
    setMenuPortalPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const handleInsertNode = useCallback((type: NodeType) => {
    if (!menuEdge) return;
    const sourceNode = nodes.find(n => n.id === menuEdge.source);
    const targetNode = nodes.find(n => n.id === menuEdge.target);
    if (!sourceNode || !targetNode) return;

    // 计算位置：中点
    const position = {
      x: (sourceNode.position.x + targetNode.position.x) / 2,
      y: (sourceNode.position.y + targetNode.position.y) / 2,
    };

    const sameTypeCount = nodes.filter((n) => n.type === type).length;
    const newNodeId = `${type}-${Date.now()}`;
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
      target: newNodeId,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 1.8, stroke: 'var(--flock-accent)' },
      type: 'smoothstep',
    };
    
    const newEdge2 = {
      id: `e-${newNodeId}-${menuEdge.target}`,
      source: newNodeId,
      target: menuEdge.target,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 1.8, stroke: 'var(--flock-accent)' },
      type: 'smoothstep',
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds.filter(e => e.id !== menuEdge.id), newEdge1, newEdge2]);

    setMenuEdge(null);
    setMenuPortalPosition(null);
  }, [menuEdge, nodes, setNodes, setEdges]);

  // ── Topological Auto Layout ───────────────────────────────────────────────
  const layoutAllNodes = useCallback(() => {
    if (nodes.length === 0) return;

    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    nodes.forEach(n => {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    });

    edges.forEach(e => {
      if (adj[e.source] && adj[e.target] !== undefined) {
        adj[e.source].push(e.target);
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      }
    });

    const rank: Record<string, number> = {};
    nodes.forEach(n => {
      rank[n.id] = 0;
    });

    const queue: string[] = [];
    nodes.forEach(n => {
      if (inDegree[n.id] === 0) {
        queue.push(n.id);
      }
    });

    if (queue.length === 0 && nodes.length > 0) {
      queue.push(nodes[0].id);
    }

    const visited = new Set<string>();
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const currRank = rank[curr];
      adj[curr].forEach(next => {
        rank[next] = Math.max(rank[next], currRank + 1);
        queue.push(next);
      });
    }

    const rankGroups: Record<number, string[]> = {};
    nodes.forEach(n => {
      const r = rank[n.id] || 0;
      if (!rankGroups[r]) {
        rankGroups[r] = [];
      }
      rankGroups[r].push(n.id);
    });

    const HORIZONTAL_GAP = 280;
    const VERTICAL_GAP = 140;

    const nextNodes = nodes.map(n => {
      const r = rank[n.id] || 0;
      const group = rankGroups[r];
      const index = group.indexOf(n.id);
      const count = group.length;

      const x = r * HORIZONTAL_GAP + 50;
      const y = (index - (count - 1) / 2) * VERTICAL_GAP + 200;

      return {
        ...n,
        position: { x, y }
      };
    });

    setNodes(nextNodes);
  }, [nodes, edges, setNodes]);

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
            style: { strokeWidth: 1.8, stroke: 'var(--flock-accent)' },
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
    (_: React.MouseEvent, node: Node) => setSelectedNodeId(node.id),
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), [setSelectedNodeId]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

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
          <Tooltip label={t('workflow.autoLayout')} withArrow openDelay={300}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={layoutAllNodes}
            >
              <IconHierarchy size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('workflow.minimap')} withArrow openDelay={300}>
            <ActionIcon
              variant={showMinimap ? 'filled' : 'subtle'}
              color={showMinimap ? 'blue' : 'gray'}
              size="sm"
              onClick={() => setShowMinimap((v) => !v)}
            >
              <IconLayoutGrid size={15} />
            </ActionIcon>
          </Tooltip>
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
        <NodePalette />

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
            onEdgeClick={onEdgeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            deleteKeyCode={['Backspace', 'Delete']}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              style: { strokeWidth: 1.8 },
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
            <Controls
              style={{
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
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
      </Box>

      {/* ── Edge click insertion floating Portal Menu ─────────────────── */}
      {menuPortalPosition && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              background: 'transparent',
            }}
            onClick={() => {
              setMenuEdge(null);
              setMenuPortalPosition(null);
            }}
          />
          <Box
            style={{
              position: 'fixed',
              left: menuPortalPosition.x,
              top: menuPortalPosition.y,
              zIndex: 10000,
              background: 'var(--flock-bg-surface, #1e1e24)',
              border: '1px solid var(--flock-border-base, #2d2d38)',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              padding: 6,
              minWidth: 168,
              backdropFilter: 'blur(8px)',
              animation: 'scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <Text
              size="10px"
              c="dimmed"
              fw={600}
              px={10}
              py={5}
              style={{
                borderBottom: '1px solid var(--flock-border-dim, #282833)',
                marginBottom: 4,
                letterSpacing: '0.05em',
              }}
            >
              {t('workflow.insertNode', 'INSERT NODE')}
            </Text>
            <Stack gap={2}>
              {Object.entries(nodeConfig).map(([type, cfg]) => {
                if (type === 'start' || type === 'end') return null;
                return (
                  <Box
                    key={type}
                    onClick={() => handleInsertNode(type as NodeType)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--flock-text-primary, #e2e8f0)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--flock-bg-hover, #2d2d38)';
                      e.currentTarget.style.paddingLeft = '12px';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.paddingLeft = '10px';
                    }}
                  >
                    <cfg.icon size={13} style={{ color: cfg.colorHex }} />
                    <span>{t(cfg.displayKey, { defaultValue: cfg.display })}</span>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </>
      )}

      {/* ── Execution panel ──────────────────────────────────────────────── */}
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
  );
}
