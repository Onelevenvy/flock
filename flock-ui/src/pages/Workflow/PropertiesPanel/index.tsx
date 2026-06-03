import { type Node } from 'reactflow';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  ScrollArea,
  TextInput,
  Stack,
  Divider,
  ThemeIcon,
  Tooltip,
  Tabs,
} from '@mantine/core';
import { IconX, IconPlayerPlay, IconSettings, IconHistory } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { useAvailableTools } from '@/hooks/useAvailableTools';
import { useState, useMemo, useEffect } from 'react';

import { ToolsIcon } from '@/components/Common/Icons';
import { useWorkflowStore } from '@/store/workflowStore';
import { useWorkflowRuntime } from '@/hooks/useWorkflowRuntime';

import { RetryTimeoutFields } from './RetryTimeoutFields';
import { NodeSpecificFields } from './NodeSpecificFields';
import { LastRunPanel } from './LastRunPanel';
import { extractVariables, type DebugVariable } from './helper';

export interface PropertiesPanelProps {
  node: Node;
  onClose: () => void;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function PropertiesPanel({ node, onClose, onDataChange }: PropertiesPanelProps) {
  const { t } = useTranslation();
  const type = node.type as NodeType;
  const cfg = nodeConfig[type];

  const [activeTab, setActiveTab] = useState<string | null>('settings');

  const { groupedOptions: modelOptions, loading: modelsLoading } = useAvailableModels();
  const { tools: availableTools, providers: availableProviders, groupedOptions: toolOptions, loading: toolsLoading } = useAvailableTools();

  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId);
  const activeExecutionThreadId = useWorkflowStore((s) => s.activeExecutionThreadId);

  const { debugNode, status: executionStatus } = useWorkflowRuntime({
    workflowId: activeWorkflowId,
    threadId: activeExecutionThreadId,
    isDebug: true,
  });

  const debugResults = useWorkflowStore((s) => s.debugResults);
  const debugResult = debugResults[node.id];

  const [missingVars, setMissingVars] = useState<DebugVariable[]>([]);

  // Automatically extract variables when node changes to prepare the debug variables form
  useEffect(() => {
    const vars = extractVariables(node.data);
    setMissingVars(vars);
  }, [node.id, node.data]);

  const executeDebug = async (mockOutputs: Record<string, any>) => {
    const payload = {
      input_msg: "",
      node_outputs: mockOutputs,
      env_vars: {} as Record<string, any>,
    };

    setActiveTab('last-run');
    if (debugNode) {
      await debugNode(node.id, JSON.stringify(payload));
    }
  };

  const handleRun = async () => {
    // If the node has dependencies, navigate to Last Run to let them fill/see the inline form
    if (missingVars.length > 0) {
      setActiveTab('last-run');
    } else {
      await executeDebug({});
    }
  };

  const toolIcon = useMemo(() => {
    if (type === 'plugin') {
      const toolData = node.data.tool as { name?: string } | undefined;
      if (toolData?.name) {
        const tool = availableTools.find((t) => t.name === toolData.name);
        if (tool) {
          const provider = availableProviders.find((p) => p.id === tool.provider_id);
          return provider?.icon || '';
        }
      }
    }
    return '';
  }, [type, node.data.tool, availableTools, availableProviders]);

  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Box
      style={{
        width: 380,
        margin: '12px 8px 8px 0',
        borderRadius: 12,
        border: '1px solid var(--flock-border-dim)',
        background: 'var(--flock-bg-base)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Group
        px="md"
        py="sm"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--flock-border-subtle)', flexShrink: 0 }}
      >
        <Group gap="xs">
          <ThemeIcon size={32} radius="lg" style={{ background: `${cfg.colorHex}15`, color: cfg.colorHex }}>
            {toolIcon ? (
              <ToolsIcon name={toolIcon} size={16} />
            ) : (
              <Icon size={16} stroke={2.5} />
            )}
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
              {t(cfg.displayKey, { defaultValue: cfg.display })}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{node.id}</Text>
          </Box>
        </Group>
        
        <Group gap={6} align="center">
          {type !== 'start' && type !== 'end' && (
            <Tooltip label={t('workflow.debugNode', 'Debug')} position="top" withArrow>
              <ActionIcon
                variant="subtle"
                color="teal"
                onClick={handleRun}
                loading={executionStatus === 'running'}
              >
                <IconPlayerPlay size={16} stroke={2.2} />
              </ActionIcon>
            </Tooltip>
          )}
          <ActionIcon variant="subtle" color="gray" onClick={onClose} className="hover-rotate-close">
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          root: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
          list: { borderBottom: '1px solid var(--flock-border-subtle)', paddingLeft: 12 },
          tab: { padding: '8px 12px', fontSize: 11, fontWeight: 600 },
          panel: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={12} />}>
            {t('workflow.debugPanel.tabSetup', 'SETTINGS')}
          </Tabs.Tab>
          <Tabs.Tab value="last-run" leftSection={<IconHistory size={12} />}>
            {t('workflow.debugPanel.tabLastRun', 'LAST RUN')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Settings / Setup */}
        <Tabs.Panel value="settings">
          <ScrollArea style={{ flex: 1 }} px="md" py="sm">
            <Stack gap="sm">
              {/* Label */}
              <TextInput
                label={t('workflow.properties.label')}
                value={String(node.data.label ?? '')}
                onChange={(e) => onDataChange(node.id, 'label', e.target.value)}
                size="xs"
              />

              <Divider label={t('workflow.properties.config')} labelPosition="center" />

              {/* Type-specific fields */}
              <NodeSpecificFields
                node={node}
                onDataChange={onDataChange}
                modelOptions={modelOptions}
                modelsLoading={modelsLoading}
                toolOptions={toolOptions}
                toolsLoading={toolsLoading}
              />

              {/* Retry & timeout config (not for start/end nodes) */}
              {type !== 'start' && type !== 'end' && (
                <>
                  <Divider />
                  <RetryTimeoutFields node={node} onDataChange={onDataChange} />
                </>
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        {/* Tab 2: Last Run */}
        <Tabs.Panel value="last-run">
          <LastRunPanel
            debugResult={debugResult}
            variables={missingVars}
            onRun={executeDebug}
            isRunning={executionStatus === 'running'}
          />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
