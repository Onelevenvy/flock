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
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '../../nodeConfig';
import { useAvailableModels } from '../../../../hooks/useAvailableModels';
import { useAvailableTools } from '../../../../hooks/useAvailableTools';

// 引入公共组件
import { VariableTextInput, VariableTextarea } from './VariableInput';

// 引入各节点专属文件夹中的配置组件
import { LLMFields } from './LLM';
import { AgentFields } from './Agent';
import { ClassifierFields } from './Classifier';
import { IfElseFields } from './IfElse';
import { HumanFields } from './Human';
import { StartFields } from './Start';
import { ParameterExtractorFields } from './ParameterExtractor';
import { RetryTimeoutFields } from './RetryTimeoutFields';

export interface PropertiesPanelProps {
  node: Node;
  onClose: () => void;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function PropertiesPanel({ node, onClose, onDataChange }: PropertiesPanelProps) {
  const { t } = useTranslation();
  const type = node.type as NodeType;
  const cfg = nodeConfig[type];

  const { groupedOptions: modelOptions, loading: modelsLoading } = useAvailableModels();
  const { groupedOptions: toolOptions, loading: toolsLoading } = useAvailableTools();

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
            <Icon size={16} stroke={2.5} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
              {t(cfg.displayKey, { defaultValue: cfg.display })}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>{node.id}</Text>
          </Box>
        </Group>
        <ActionIcon variant="subtle" color="gray" onClick={onClose} className="hover-rotate-close">
          <IconX size={16} />
        </ActionIcon>
      </Group>

      {/* Scrollable form */}
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
        <VariableTextInput
          label={t('workflow.properties.plugin.args')}
          placeholder='{"key": "value"}'
          value={String(node.data.args ?? '')}
          currentNodeId={node.id}
          onChange={(val) => onDataChange(node.id, 'args', val)}
          size="xs"
        />
      );

    default:
      return null;
  }
}
