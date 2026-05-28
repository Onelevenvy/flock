import { useState, useEffect } from 'react';
import { Box, Text, Group, ActionIcon, Textarea, TextInput, Button, Stack, ScrollArea, Badge, Divider, Tabs } from '@mantine/core';
import { IconX, IconPlayerPlay, IconSettings, IconHistory } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useWorkflowExecution } from '../../../hooks/useWorkflowExecution';

interface NodeDebugPanelProps {
  nodeId: string;
  onClose: () => void;
  onRunStart?: () => void;
}

export function NodeDebugPanel({ nodeId, onClose, onRunStart }: NodeDebugPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [mockInputs, setMockInputs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string | null>('setup');

  const { debugNode } = useWorkflowExecution();
  const executionStatus = useWorkflowStore((s) => s.executionStatus);
  const nodes = useWorkflowStore((s) => s.nodes);
  const debugResults = useWorkflowStore((s) => s.debugResults);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeLabel = node?.data?.label || nodeId;
  const nodeType = node?.type || 'unknown';

  const debugResult = debugResults[nodeId];

  // Scan node data for any referenced variables `${variable_name}`
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  useEffect(() => {
    if (!node?.data) return;
    const vars: string[] = [];
    const regex = /\$\{([^}]+)\}/g;
    
    const scan = (value: any) => {
      if (typeof value === 'string') {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(value)) !== null) {
          vars.push(match[1]);
        }
      } else if (Array.isArray(value)) {
        value.forEach(scan);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(scan);
      }
    };
    
    scan(node.data);
    setDetectedVars(Array.from(new Set(vars)));
  }, [node?.data]);

  const handleRun = async () => {
    const payload = {
      input_msg: input,
      node_outputs: {} as Record<string, any>,
      env_vars: {} as Record<string, any>,
    };
    
    for (const [path, val] of Object.entries(mockInputs)) {
      if (path.startsWith('env.')) {
        const varName = path.slice(4);
        payload.env_vars[varName] = val;
      } else if (path === 'start.query') {
        payload.input_msg = val;
        payload.node_outputs['start'] = payload.node_outputs['start'] || {};
        payload.node_outputs['start']['query'] = val;
      } else {
        const parts = path.split('.');
        if (parts.length >= 2) {
          const nodeIdPart = parts[0];
          const fieldName = parts.slice(1).join('.');
          payload.node_outputs[nodeIdPart] = payload.node_outputs[nodeIdPart] || {};
          payload.node_outputs[nodeIdPart][fieldName] = val;
        }
      }
    }
    
    if (onRunStart) {
      onRunStart();
    }
    // Switch to Last Run tab immediately so user sees progress
    setActiveTab('last-run');
    await debugNode(nodeId, JSON.stringify(payload));
  };

  return (
    <Box
      style={{
        width: 320,
        borderLeft: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
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
          <Badge size="xs" color="orange" variant="light">
            {t('workflow.debugPanel.badge', 'DEBUG')}
          </Badge>
          <Box>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
              {nodeLabel}
            </Text>
            <Text size="xs" c="dimmed">{nodeType} · {nodeId}</Text>
          </Box>
        </Group>
        <ActionIcon variant="subtle" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
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
          <Tabs.Tab value="setup" leftSection={<IconSettings size={12} />}>
            {t('workflow.debugPanel.tabSetup', 'Setup')}
          </Tabs.Tab>
          <Tabs.Tab value="last-run" leftSection={<IconHistory size={12} />}>
            {t('workflow.debugPanel.tabLastRun', 'Last Run')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Setup */}
        <Tabs.Panel value="setup">
          <ScrollArea style={{ flex: 1 }} px="md" py="sm">
            <Stack gap="sm">
              {/* Main User Query Input */}
              <Textarea
                label={t('workflow.debugPanel.input', 'Test Input')}
                placeholder={t('workflow.debugPanel.inputPlaceholder', 'Enter test input/query for this node...')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                minRows={3}
                size="xs"
              />

              {/* Dynamic Mock Variable Fields */}
              {detectedVars.length > 0 && (
                <>
                  <Divider label={t('workflow.debugPanel.mockVariables', 'Mock Dependency Variables')} labelPosition="center" />
                  <Stack gap="xs">
                    {detectedVars.map((varPath) => (
                      <TextInput
                        key={varPath}
                        label={`\${${varPath}}`}
                        placeholder={`Mock value for ${varPath}`}
                        value={mockInputs[varPath] ?? ''}
                        onChange={(e) => setMockInputs({ ...mockInputs, [varPath]: e.target.value })}
                        size="xs"
                      />
                    ))}
                  </Stack>
                </>
              )}

              <Button
                leftSection={<IconPlayerPlay size={14} />}
                onClick={handleRun}
                loading={executionStatus === 'running'}
                size="xs"
                color="teal"
                fullWidth
              >
                {t('workflow.debugPanel.run', 'Run Node')}
              </Button>
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        {/* Tab 2: Last Run */}
        <Tabs.Panel value="last-run">
          <ScrollArea style={{ flex: 1 }} px="md" py="sm">
            {!debugResult ? (
              <Box style={{ padding: 24, textAlign: 'center' }}>
                <Text size="xs" c="dimmed">
                  {t('workflow.debugPanel.noRunResult', 'No run results yet. Configure inputs and click Run Node.')}
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
                    border: `1px solid ${
                      debugResult.status === 'done' 
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
