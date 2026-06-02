import { type Node } from 'reactflow';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  ScrollArea,
  TextInput,
  Select,
  Textarea,
  Stack,
  Divider,
  ThemeIcon,
  Tooltip,
  Tabs,
  Badge,
} from '@mantine/core';
import { IconX, IconPlayerPlay, IconSettings, IconHistory } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { useAvailableTools } from '@/hooks/useAvailableTools';
import { useState, useEffect } from 'react';

// 引入公共组件
import { VariableTextInput, VariableTextarea } from './VariableInput';

import { ToolsIcon } from '@/components/Common/Icons';
import { useWorkflowStore } from '@/store/workflowStore';
import { useWorkflowRuntime } from '@/hooks/useWorkflowRuntime';

// 引入各节点专属文件夹中的配置组件
import { LLMFields } from './LLM';
import { AgentFields } from './Agent';
import { ClassifierFields } from './Classifier';
import { IfElseFields } from './IfElse';
import { HumanFields } from './Human';
import { StartFields } from './Start';
import { ParameterExtractorFields } from './ParameterExtractor';
import { PluginFields } from './Plugin';
import { RetryTimeoutFields } from './RetryTimeoutFields';
import { useMemo } from 'react';

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

  const handleRun = async () => {
    // 自动收集该节点当前 settings 面板里的最新数据传给后端
    // 调试的时候，直接从 node.data 构建 payload 送去后端
    const payload = {
      input_msg: "",
      node_outputs: {} as Record<string, any>,
      env_vars: {} as Record<string, any>,
    };

    setActiveTab('last-run');
    if (debugNode) {
      await debugNode(node.id, JSON.stringify(payload));
    }
  };

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
          <ScrollArea style={{ flex: 1 }} px="md" py="sm">
            {!debugResult ? (
              <Box style={{ padding: 24, textAlign: 'center' }}>
                <Text size="xs" c="dimmed">
                  {t('workflow.debugPanel.noRunResult', 'No run results yet. Click the play button to run this node.')}
                </Text>
              </Box>
            ) : (
              <Stack gap="sm">
                {/* Status Bar */}
                <Box
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: debugResult.status === 'done'
                      ? 'var(--flock-accent-soft, rgba(21, 90, 239, 0.08))'
                      : debugResult.status === 'running'
                        ? 'rgba(34, 139, 230, 0.08)'
                        : 'rgba(250, 82, 82, 0.08)',
                    border: `1px solid ${debugResult.status === 'done'
                        ? 'var(--flock-accent)'
                        : debugResult.status === 'running'
                          ? '#228be6'
                          : '#fa5252'
                      }`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Group gap="xs">
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: debugResult.status === 'done' ? '#40c057' : debugResult.status === 'running' ? '#228be6' : '#fa5252'
                    }} />
                    <Text size="xs" fw={700} style={{
                      color: debugResult.status === 'done' ? 'var(--flock-accent)' : debugResult.status === 'running' ? '#228be6' : '#fa5252',
                      fontSize: 10,
                    }}>
                      {debugResult.status === 'done' ? 'SUCCESS' : debugResult.status === 'running' ? 'RUNNING' : 'FAILED'}
                    </Text>
                  </Group>
                  {debugResult.duration !== undefined && (
                    <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                      {(debugResult.duration / 1000).toFixed(3)}s
                    </Text>
                  )}
                </Box>

                {/* Input JSON Block */}
                {debugResult.input && (
                  <Box>
                    <Text size="xs" fw={600} mb={4} style={{ color: 'var(--flock-text-bright)' }}>
                      {t('workflow.debugPanel.inputData', 'Input')}
                    </Text>
                    <Box
                      style={{
                        maxHeight: 150,
                        overflow: 'auto',
                        padding: 8,
                        borderRadius: 8,
                        background: 'var(--flock-bg-raised, rgba(0,0,0,0.02))',
                        border: '1px solid var(--flock-border-subtle)',
                      }}
                    >
                      <pre style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--flock-text-secondary)' }}>
                        {JSON.stringify(debugResult.input, null, 2)}
                      </pre>
                    </Box>
                  </Box>
                )}

                {/* Output JSON Block */}
                <Box>
                  <Text size="xs" fw={600} mb={4} style={{ color: 'var(--flock-text-bright)' }}>
                    {t('workflow.debugPanel.outputData', 'Output')}
                  </Text>
                  <Box
                      style={{
                        maxHeight: 180,
                        overflow: 'auto',
                        padding: 8,
                        borderRadius: 8,
                        background: 'var(--flock-bg-raised, rgba(0,0,0,0.02))',
                        border: '1px solid var(--flock-border-subtle)',
                      }}
                    >
                    <pre style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--flock-text-secondary)' }}>
                      {debugResult.status === 'running'
                        ? 'Running...'
                        : debugResult.error
                          ? debugResult.error
                          : JSON.stringify(debugResult.output, null, 2)}
                    </pre>
                  </Box>
                </Box>

                {/* Metadata Details */}
                <Divider />
                <Box style={{ fontSize: 11 }}>
                  <Text size="xs" fw={600} mb={6} style={{ color: 'var(--flock-text-bright)' }}>
                    {t('workflow.debugPanel.metaTitle', 'Metadata')}
                  </Text>
                  <Stack gap={6}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{t('workflow.debugPanel.metaStatus', 'Status')}</Text>
                      <Text size="xs" fw={500} style={{ fontSize: 10 }}>{debugResult.status.toUpperCase()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{t('workflow.debugPanel.metaStartTime', 'Start Time')}</Text>
                      <Text size="xs" fw={500} style={{ fontSize: 10 }}>{new Date(debugResult.startTime).toLocaleTimeString()}</Text>
                    </Group>
                    {debugResult.duration !== undefined && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{t('workflow.debugPanel.metaDuration', 'Duration')}</Text>
                        <Text size="xs" fw={500} style={{ fontSize: 10 }}>{(debugResult.duration / 1000).toFixed(3)}s</Text>
                      </Group>
                    )}
                  </Stack>
                </Box>
              </Stack>
            )}
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

interface NodeSpecificFieldsProps {
  node: Node;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
  toolOptions: any[];
  toolsLoading: boolean;
}

function NodeSpecificFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
  toolOptions,
  toolsLoading,
}: NodeSpecificFieldsProps) {
  const { t } = useTranslation();
  const type = node.type as NodeType;

  switch (type) {
    case 'start':
      return <StartFields node={node} onDataChange={onDataChange} />;

    case 'end':
      return (
        <Text size="xs" c="dimmed" ta="center" py="sm">
          {t('workflow.properties.noConfig')}
        </Text>
      );

    case 'llm':
      return (
        <LLMFields
          node={node}
          onDataChange={onDataChange}
          modelOptions={modelOptions}
          modelsLoading={modelsLoading}
        />
      );

    case 'agent':
      return (
        <AgentFields
          node={node}
          onDataChange={onDataChange}
          modelOptions={modelOptions}
          modelsLoading={modelsLoading}
          toolOptions={toolOptions}
          toolsLoading={toolsLoading}
        />
      );

    case 'classifier':
      return (
        <ClassifierFields
          node={node}
          onDataChange={onDataChange}
          modelOptions={modelOptions}
          modelsLoading={modelsLoading}
        />
      );

    case 'ifelse':
      return <IfElseFields node={node} onDataChange={onDataChange} />;

    case 'answer':
      return (
        <VariableTextarea
          label={t('workflow.properties.answer.template')}
          placeholder="${llm.response}"
          value={String(node.data.answer ?? '')}
          currentNodeId={node.id}
          onChange={(val) => onDataChange(node.id, 'answer', val)}
          minRows={4}
          size="xs"
        />
      );

    case 'code':
      return (
        <>
          <Select
            label={t('workflow.properties.code.language')}
            data={['python', 'javascript']}
            value={String(node.data.language ?? 'python')}
            onChange={(v) => onDataChange(node.id, 'language', v)}
            size="xs"
          />
          <Textarea
            label={t('workflow.properties.code.code')}
            placeholder="# Your code here"
            value={String(node.data.code ?? '')}
            onChange={(e) => onDataChange(node.id, 'code', e.target.value)}
            minRows={6}
            size="xs"
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
          />
        </>
      );

    case 'parameterExtractor':
      return (
        <ParameterExtractorFields
          node={node}
          onDataChange={onDataChange}
          modelOptions={modelOptions}
          modelsLoading={modelsLoading}
        />
      );

    case 'human':
      return (
        <HumanFields
          node={node}
          onDataChange={onDataChange}
        />
      );

    case 'plugin':
      return (
        <PluginFields
          node={node}
          onDataChange={onDataChange}
        />
      );

    default:
      return null;
  }
}
