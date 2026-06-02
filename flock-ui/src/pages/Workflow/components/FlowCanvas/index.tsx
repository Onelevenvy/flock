import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
import { Box, Group, Button, ActionIcon, Tooltip, Divider, ThemeIcon, Badge, Text, Transition, Modal, TextInput, Textarea, Stack, Table, ScrollArea, Tabs } from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconRoute,
  IconKey,
  IconHistory,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { workflowNodeTypes } from '@/pages/Workflow/nodes/nodeTypesMap';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUpdateWorkflow, type WorkflowRecord } from '@/hooks/useWorkflow';
import { useQueryClient } from '@tanstack/react-query';
import { NodePalette } from '@/pages/Workflow/components/NodePalette';
import { IconPicker } from '@/pages/Assistant/IconPicker';
import { CustomStepEdge } from '@/pages/Workflow/components/CustomStepEdge';
import { PropertiesPanel } from '@/pages/Workflow/components/PropertiesPanel';
import { ExecutionPanel } from '@/components/chat/workflow/ExecutionPanel';
import { EnvironmentVarsPanel } from '@/pages/Workflow/components/EnvironmentVarsPanel';
import { useWorkflowRuntime } from '@/hooks/useWorkflowRuntime';

import { useFlowLayout } from './hooks/useFlowLayout';
import { useNodeInsertion } from './hooks/useNodeInsertion';
import { useFlowHandlers } from './hooks/useFlowHandlers';
import { useDropHandler } from './hooks/useDropHandler';
import { useActiveNodeGlow } from './hooks/useActiveNodeGlow';
import { LeftToolbar } from './components/LeftToolbar';
import { EdgeInsertMenu } from './components/EdgeInsertMenu';
import { invoke } from '@tauri-apps/api/core';

interface FlowCanvasProps {
  workflowId: string;
  workflowData: WorkflowRecord;
  onBack: () => void;
}

export function FlowCanvas({ workflowId, workflowData, onBack }: FlowCanvasProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const updateMutation = useUpdateWorkflow();
  const queryClient = useQueryClient();

  const [workflowIcon, setWorkflowIcon] = useState(() => {
    return (workflowData.config?.metadata?.icon as string) || '🤖';
  });

  useEffect(() => {
    if (workflowData.config?.metadata?.icon) {
      setWorkflowIcon(workflowData.config.metadata.icon as string);
    }
  }, [workflowData]);

  const handleIconChange = (newIcon: string) => {
    setWorkflowIcon(newIcon);
    setDirty(true);
  };

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
    environmentVariables,
    pendingStartQuery,
    setPendingStartQuery,
    activeExecutionThreadId,
  } = useWorkflowStore();

  const {
    messages: executionMessages,
    status: executionStatus,
    activeInterrupt: executionActiveInterrupt,
    startWorkflow,
    resumeWorkflow,
    stopWorkflow,
    clearExecution,
  } = useWorkflowRuntime({
    workflowId,
    threadId: activeExecutionThreadId,
    isDebug: true,
  });

  const [showExecution, setShowExecution] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [isPanMode, setIsPanMode] = useState(true);



  // ── Topological Auto Layout Hook ───────────────────────────────────────
  const { layoutAllNodes } = useFlowLayout(nodes, edges, setNodes, setEdges);

  // ── Active execution node tracking & glow effect ────────────────────────
  const activeNodeId = useActiveNodeGlow(executionMessages, executionStatus);

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

  const saveDraftImmediately = useCallback(async () => {
    if (!workflowId) return;
    try {
      const metadata = {
        ...(workflowData?.config?.metadata ?? {}),
        env_vars: environmentVariables,
        icon: workflowIcon,
      };
      const nameVal = workflowData?.name || "";
      const descVal = workflowData?.description || "";
      await invoke('update_workflow', {
        id: workflowId,
        input: {
          name: { zh: nameVal, en: nameVal },
          description: { zh: descVal, en: descVal },
          is_active: workflowData?.is_active ?? true,
          config: { nodes, edges, metadata },
        },
      });
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch (e) {
      console.error("Auto silent save draft workflow failed:", e);
    }
  }, [workflowId, workflowData, nodes, edges, environmentVariables, workflowIcon, setDirty, queryClient]);

  const saveRef = useRef(saveDraftImmediately);
  useEffect(() => {
    saveRef.current = saveDraftImmediately;
  }, [saveDraftImmediately]);

  // ── Auto Silent Save Draft Config ──
  // 每当节点、连线、环境变量、图标变化时，自动将当前状态静默保存到 config (草稿数据库)
  useEffect(() => {
    if (!workflowId) return;
    // 延迟 1500ms 防抖，避免拖拽或连续输入时高频调用 API
    const timer = setTimeout(saveDraftImmediately, 1500);
    return () => clearTimeout(timer);
  }, [workflowId, saveDraftImmediately]);

  // 当组件卸载或切换工作流时，如果有未保存的变更则立即保存
  useEffect(() => {
    return () => {
      const store = useWorkflowStore.getState();
      if (store.isDirty) {
        saveRef.current();
      }
    };
  }, [workflowId]);

  // 将保存草稿的函数引用同步到全局 Store，供其他调试面板执行前触发强制自动保存
  useEffect(() => {
    const store = useWorkflowStore.getState();
    if (store.saveDraftRef) {
      store.saveDraftRef.current = saveDraftImmediately;
    }
    return () => {
      const currentStore = useWorkflowStore.getState();
      if (currentStore.saveDraftRef) {
        currentStore.saveDraftRef.current = null;
      }
    };
  }, [saveDraftImmediately]);

  // ── Publish States ──
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('V1.0.0');
  const [newDescription, setNewDescription] = useState('');
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);

  // ── Load History Versions & Auto Increment ──
  const loadHistoryVersions = useCallback(async () => {
    try {
      const res = await invoke<any[]>('list_workflow_versions', { workflowId });
      setHistoryVersions(res || []);
      if (res && res.length > 0) {
        const latest = res[0].version;
        const match = latest.match(/^[vV]?(\d+)\.(\d+)\.(\d+)$/);
        if (match) {
          const major = match[1];
          const minor = match[2];
          const patch = parseInt(match[3], 10) + 1;
          setNewVersion(`V${major}.${minor}.${patch}`);
        } else {
          setNewVersion(latest + '_next');
        }
      } else {
        setNewVersion('V1.0.0');
      }
    } catch (e) {
      console.error("Failed to load workflow versions:", e);
      setHistoryVersions([]);
      setNewVersion('V1.0.0');
    }
  }, [workflowId]);

  const handlePublishClick = useCallback(() => {
    setPublishModalOpen(true);
    loadHistoryVersions();
  }, [loadHistoryVersions]);

  // ── Submit Publish ──
  const handlePublishSubmit = async () => {
    const metadata = {
      ...(workflowData.config.metadata ?? {}),
      env_vars: environmentVariables,
      icon: workflowIcon,
    };
    await updateMutation.mutateAsync({
      id: workflowId,
      input: {
        name: workflowData.name,
        description: workflowData.description,
        is_active: workflowData.is_active,
        config: { nodes, edges, metadata },
      },
    });
    try {
      await invoke('publish_workflow', {
        id: workflowId,
        version: newVersion,
        description: newDescription || null,
      });
      setDirty(false);
      setPublishModalOpen(false);
      setNewDescription('');
    } catch (e) {
      console.error("Publish workflow failed:", e);
    }
  };

  // ── Rollback Draft to History Version ──
  const handleRollbackDraft = useCallback(async (versionId: string) => {
    try {
      const updatedWf = await invoke<any>('rollback_workflow_draft', {
        workflowId,
        versionId,
      });
      if (updatedWf && updatedWf.config) {
        useWorkflowStore.getState().loadWorkflowConfig(updatedWf.config);
      }
      setPublishModalOpen(false);
    } catch (e) {
      console.error("Rollback draft failed:", e);
    }
  }, [workflowId]);

  // ── Switch Active Production to History Version ──
  const handleSwitchProduction = useCallback(async (versionId: string) => {
    try {
      await invoke('switch_workflow_production', {
        workflowId,
        versionId,
      });
      loadHistoryVersions();
    } catch (e) {
      console.error("Switch production version failed:", e);
    }
  }, [workflowId, loadHistoryVersions]);

  // ── Auto-start workflow if navigated from home page with a query ────────
  useEffect(() => {
    if (pendingStartQuery && workflowId) {
      const runPending = async () => {
        if (isDirty) {
          await saveDraftImmediately();
        }
        setShowExecution(true);
        startWorkflow(JSON.stringify({ query: pendingStartQuery }));
        setPendingStartQuery(null);
      };
      runPending();
    }
  }, [pendingStartQuery, workflowId, isDirty, saveDraftImmediately, startWorkflow, setPendingStartQuery]);

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
          <IconPicker value={workflowIcon} onChange={handleIconChange} size={28} />
          <Box>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)', lineHeight: 1.2 }}>
              {workflowData.name}
            </Text>
          </Box>
        </Group>

        <Group gap="xs">
          <Tooltip label={t('workflow.envVars.toggle', 'Environment Variables')} withArrow openDelay={300}>
            <ActionIcon
              variant={showEnvVars ? 'filled' : 'subtle'}
              color={showEnvVars ? 'blue' : 'gray'}
              size="sm"
              onClick={() => setShowEnvVars((v) => !v)}
            >
              <IconKey size={15} />
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
            onClick={handlePublishClick}
            style={{ background: 'var(--flock-accent)', boxShadow: '0 2px 8px rgba(21,90,239,0.2)' }}
            color="blue"
          >
            {t('workflow.publish', 'Publish')}
          </Button>
        </Group>
      </Group>

      {/* ── Canvas area ─────────────────────────────────────────────────── */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--flock-bg-deepest)' }}>
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
            t={t as any}
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
            style={{ background: 'var(--flock-bg-deepest)' }}
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

        {showEnvVars && (
          <EnvironmentVarsPanel onClose={() => setShowEnvVars(false)} />
        )}

        {selectedNode && !showEnvVars && (
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
                await saveDraftImmediately();
              }
              await startWorkflow(input);
            }}
            stopWorkflow={stopWorkflow}
            resumeWorkflow={resumeWorkflow}
            onClearExecution={clearExecution}
            activeInterrupt={executionActiveInterrupt}
          />
        )}
      </Box>

      {/* ── Edge click insertion floating Portal Menu ─────────────────── */}
      <EdgeInsertMenu
        menuPortalPosition={menuPortalPosition}
        onClose={closeMenu}
        onAddNode={handleInsertNode}
      />

      {/* ── Publish & Version Management Modal ────────────────────────── */}
      <Modal
        opened={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title={t('workflow.version_management', 'Version Management')}
        size="lg"
      >
        <Tabs defaultValue="publish">
          <Tabs.List>
            <Tabs.Tab value="publish">{t('workflow.publish_new', 'Publish New Version')}</Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
              {t('workflow.version_history', 'Version History')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="publish" pt="md">
            <Stack gap="md">
              <TextInput
                label={t('workflow.version_number', 'Version Number')}
                placeholder="e.g. V1.0.0"
                value={newVersion}
                onChange={(e) => setNewVersion(e.currentTarget.value)}
                required
              />
              <Textarea
                label={t('workflow.publish_description', 'Publish Description (Optional)')}
                placeholder={t('workflow.publish_description_placeholder', 'Enter what changed in this version...')}
                value={newDescription}
                onChange={(e) => setNewDescription(e.currentTarget.value)}
                rows={3}
              />
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setPublishModalOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button onClick={handlePublishSubmit} style={{ background: 'var(--flock-accent)' }}>
                  {t('workflow.publish', 'Publish')}
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            <ScrollArea h={300} offsetScrollbars>
              {historyVersions.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  {t('workflow.no_versions', 'No published versions yet.')}
                </Text>
              ) : (
                <Table variant="simple" verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('workflow.version', 'Version')}</Table.Th>
                      <Table.Th>{t('workflow.description', 'Description')}</Table.Th>
                      <Table.Th>{t('workflow.published_at', 'Published At')}</Table.Th>
                      <Table.Th style={{ width: 220 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {historyVersions.map((v) => (
                      <Table.Tr key={v.id}>
                        <Table.Td>
                          <Badge variant="light">{v.version}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" style={{ wordBreak: 'break-all' }}>
                            {v.description || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {new Date(v.created_at).toLocaleString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => handleRollbackDraft(v.id)}
                            >
                              {t('workflow.rollback_draft', 'Rollback Draft')}
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleSwitchProduction(v.id)}
                            >
                              {t('workflow.set_production', 'Set Active')}
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </Box>
  );
}
