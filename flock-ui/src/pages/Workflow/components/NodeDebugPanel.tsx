import { useState, useEffect } from 'react';
import { Box, Text, Group, ActionIcon, Textarea, TextInput, Button, Stack, ScrollArea, Badge, Divider } from '@mantine/core';
import { IconX, IconPlayerPlay } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useWorkflowExecution } from '../../../hooks/useWorkflowExecution';

interface NodeDebugPanelProps {
  nodeId: string;
  onClose: () => void;
}

export function NodeDebugPanel({ nodeId, onClose }: NodeDebugPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [mockInputs, setMockInputs] = useState<Record<string, string>>({});
  const { debugNode } = useWorkflowExecution();
  const executionStatus = useWorkflowStore((s) => s.executionStatus);
  const nodes = useWorkflowStore((s) => s.nodes);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeLabel = node?.data?.label || nodeId;
  const nodeType = node?.type || 'unknown';

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

      {/* Input area */}
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

          <Text size="xs" c="dimmed">
            {t('workflow.debugPanel.hint', 'Output will appear in the execution panel. Open it via the play button in the toolbar.')}
          </Text>
        </Stack>
      </ScrollArea>
    </Box>
  );
}

