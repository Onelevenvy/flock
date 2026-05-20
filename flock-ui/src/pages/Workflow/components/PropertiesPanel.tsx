import { type Node } from 'reactflow';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  ScrollArea,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Stack,
  Divider,
  ThemeIcon,
  Badge,
  Button,
} from '@mantine/core';
import { IconX, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '../nodeConfig';
import { v4 as uuidv4 } from 'uuid';

interface PropertiesPanelProps {
  node: Node;
  onClose: () => void;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function PropertiesPanel({ node, onClose, onDataChange }: PropertiesPanelProps) {
  const { t } = useTranslation();
  const type = node.type as NodeType;
  const cfg = nodeConfig[type];

  if (!cfg) return null;
  const Icon = cfg.icon;

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
          <ThemeIcon size={28} radius="md" style={{ background: cfg.colorHex }}>
            <Icon size={14} stroke={2} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
              {t(cfg.displayKey, { defaultValue: cfg.display })}
            </Text>
            <Text size="xs" c="dimmed">{node.id}</Text>
          </Box>
        </Group>
        <ActionIcon variant="subtle" onClick={onClose}>
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
          <NodeSpecificFields node={node} onDataChange={onDataChange} />
        </Stack>
      </ScrollArea>
    </Box>
  );
}

// ── Node-specific fields ──────────────────────────────────────────────────

interface FieldsProps {
  node: Node;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

function NodeSpecificFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  const type = node.type as NodeType;

  switch (type) {
    case 'start':
    case 'end':
      return (
        <Text size="xs" c="dimmed" ta="center" py="sm">
          {t('workflow.properties.noConfig')}
        </Text>
      );

    case 'llm':
      return <LLMFields node={node} onDataChange={onDataChange} />;

    case 'agent':
      return <AgentFields node={node} onDataChange={onDataChange} />;

    case 'classifier':
      return <ClassifierFields node={node} onDataChange={onDataChange} />;

    case 'ifelse':
      return <IfElseFields node={node} onDataChange={onDataChange} />;

    case 'answer':
      return (
        <Textarea
          label={t('workflow.properties.answer.template')}
          placeholder="${llm.response}"
          value={String(node.data.answer ?? '')}
          onChange={(e) => onDataChange(node.id, 'answer', e.target.value)}
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
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          />
        </>
      );

    case 'parameterExtractor':
      return <ParameterExtractorFields node={node} onDataChange={onDataChange} />;

    case 'human':
      return (
        <Textarea
          label={t('workflow.properties.human.title')}
          placeholder={t('workflow.properties.human.titlePlaceholder')}
          value={String(node.data.title ?? '')}
          onChange={(e) => onDataChange(node.id, 'title', e.target.value)}
          minRows={2}
          size="xs"
        />
      );

    case 'plugin':
      return (
        <TextInput
          label={t('workflow.properties.plugin.args')}
          placeholder='{"key": "value"}'
          value={String(node.data.args ?? '')}
          onChange={(e) => onDataChange(node.id, 'args', e.target.value)}
          size="xs"
        />
      );

    default:
      return null;
  }
}

// ── LLM fields ──────────────────────────────────────────────────────────────

function LLMFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <TextInput
        label={t('workflow.properties.llm.model')}
        placeholder="e.g. gpt-4o"
        value={String(node.data.model ?? '')}
        onChange={(e) => onDataChange(node.id, 'model', e.target.value)}
        size="xs"
      />
      <NumberInput
        label={t('workflow.properties.llm.temperature')}
        value={Number(node.data.temperature ?? 0.7)}
        onChange={(v) => onDataChange(node.id, 'temperature', v)}
        min={0}
        max={2}
        step={0.1}
        decimalScale={1}
        size="xs"
      />
      <Textarea
        label={t('workflow.properties.llm.systemPrompt')}
        placeholder={t('workflow.properties.llm.systemPromptPlaceholder')}
        value={String(node.data.systemMessage ?? '')}
        onChange={(e) => onDataChange(node.id, 'systemMessage', e.target.value)}
        minRows={3}
        size="xs"
      />
      <Textarea
        label={t('workflow.properties.llm.userPrompt')}
        placeholder="${start.query}"
        value={String(node.data.userMessage ?? '')}
        onChange={(e) => onDataChange(node.id, 'userMessage', e.target.value)}
        minRows={3}
        size="xs"
      />
    </>
  );
}

// ── Agent fields ─────────────────────────────────────────────────────────────

function AgentFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  const tools = (node.data.tools as string[]) ?? [];

  return (
    <>
      <LLMFields node={node} onDataChange={onDataChange} />
      <Divider label={t('workflow.properties.agent.tools')} labelPosition="center" />
      <Stack gap={4}>
        {tools.map((tool, i) => (
          <Group key={i} gap={4}>
            <TextInput
              value={tool}
              onChange={(e) => {
                const next = [...tools];
                next[i] = e.target.value;
                onDataChange(node.id, 'tools', next);
              }}
              size="xs"
              style={{ flex: 1 }}
            />
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={() => {
                const next = tools.filter((_, idx) => idx !== i);
                onDataChange(node.id, 'tools', next);
              }}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => onDataChange(node.id, 'tools', [...tools, ''])}
        >
          {t('workflow.properties.agent.addTool')}
        </Button>
      </Stack>
    </>
  );
}

// ── Classifier fields ─────────────────────────────────────────────────────────

function ClassifierFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  const categories = (node.data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <>
      <TextInput
        label={t('workflow.properties.classifier.input')}
        placeholder="${start.query}"
        value={String(node.data.input ?? '')}
        onChange={(e) => onDataChange(node.id, 'input', e.target.value)}
        size="xs"
      />
      <TextInput
        label={t('workflow.properties.llm.model')}
        placeholder="e.g. gpt-4o"
        value={String(node.data.model ?? '')}
        onChange={(e) => onDataChange(node.id, 'model', e.target.value)}
        size="xs"
      />
      <Divider label={t('workflow.properties.classifier.categories')} labelPosition="center" />
      <Stack gap={4}>
        {categories.map((cat, i) => (
          <Group key={cat.category_id} gap={4}>
            <TextInput
              placeholder={t('workflow.properties.classifier.categoryName')}
              value={cat.category_name}
              onChange={(e) => {
                const next = [...categories];
                next[i] = { ...cat, category_name: e.target.value };
                onDataChange(node.id, 'categories', next);
              }}
              size="xs"
              style={{ flex: 1 }}
              disabled={cat.category_id === 'others_category'}
            />
            {cat.category_id !== 'others_category' && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => {
                  const next = categories.filter((_, idx) => idx !== i);
                  onDataChange(node.id, 'categories', next);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
            {cat.category_id === 'others_category' && (
              <Badge size="xs" variant="light" color="gray">Others</Badge>
            )}
          </Group>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            const others = categories.filter((c) => c.category_id === 'others_category');
            const rest = categories.filter((c) => c.category_id !== 'others_category');
            onDataChange(node.id, 'categories', [
              ...rest,
              { category_id: uuidv4(), category_name: '' },
              ...others,
            ]);
          }}
        >
          {t('workflow.properties.classifier.addCategory')}
        </Button>
      </Stack>
    </>
  );
}

// ── IfElse fields ─────────────────────────────────────────────────────────────

function IfElseFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  const cases = (node.data.cases as { case_id: string; logical_operator: string; conditions: unknown[] }[]) ?? [];

  return (
    <Stack gap="xs">
      {cases.map((c, i) => (
        <Box
          key={c.case_id}
          style={{
            border: '1px solid var(--flock-border-subtle)',
            borderRadius: 8,
            padding: '8px',
          }}
        >
          <Group justify="space-between" mb={4}>
            <Badge size="xs" color={c.case_id === 'false_else' ? 'gray' : 'violet'} variant="light">
              {c.case_id === 'false_else' ? 'ELSE' : `IF ${i + 1}`}
            </Badge>
            {c.case_id !== 'false_else' && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => {
                  const next = cases.filter((_, idx) => idx !== i);
                  onDataChange(node.id, 'cases', next);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
          </Group>
          {c.case_id !== 'false_else' && (
            <TextInput
              placeholder={t('workflow.properties.ifelse.conditionPlaceholder')}
              size="xs"
              value={JSON.stringify(c.conditions)}
              onChange={(e) => {
                try {
                  const next = [...cases];
                  next[i] = { ...c, conditions: JSON.parse(e.target.value) };
                  onDataChange(node.id, 'cases', next);
                } catch {}
              }}
            />
          )}
        </Box>
      ))}
      <Button
        size="xs"
        variant="light"
        leftSection={<IconPlus size={12} />}
        onClick={() => {
          const others = cases.filter((c) => c.case_id === 'false_else');
          const rest = cases.filter((c) => c.case_id !== 'false_else');
          onDataChange(node.id, 'cases', [
            ...rest,
            { case_id: uuidv4(), logical_operator: 'and', conditions: [] },
            ...others,
          ]);
        }}
      >
        {t('workflow.properties.ifelse.addCase')}
      </Button>
    </Stack>
  );
}

// ── ParameterExtractor fields ─────────────────────────────────────────────────

function ParameterExtractorFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  const parameters = (node.data.parameters as { name: string; type: string; description: string; required: boolean }[]) ?? [];

  return (
    <>
      <TextInput
        label={t('workflow.properties.llm.model')}
        placeholder="e.g. gpt-4o"
        value={String(node.data.model ?? '')}
        onChange={(e) => onDataChange(node.id, 'model', e.target.value)}
        size="xs"
      />
      <TextInput
        label={t('workflow.properties.extractor.input')}
        placeholder="${start.query}"
        value={String(node.data.input ?? '')}
        onChange={(e) => onDataChange(node.id, 'input', e.target.value)}
        size="xs"
      />
      <Textarea
        label={t('workflow.properties.extractor.instruction')}
        value={String(node.data.instruction ?? '')}
        onChange={(e) => onDataChange(node.id, 'instruction', e.target.value)}
        minRows={2}
        size="xs"
      />
      <Divider label={t('workflow.properties.extractor.parameters')} labelPosition="center" />
      <Stack gap={4}>
        {parameters.map((p, i) => (
          <Group key={i} gap={4} align="flex-start">
            <Stack gap={2} style={{ flex: 1 }}>
              <TextInput
                placeholder={t('workflow.properties.extractor.paramName')}
                value={p.name}
                onChange={(e) => {
                  const next = [...parameters];
                  next[i] = { ...p, name: e.target.value };
                  onDataChange(node.id, 'parameters', next);
                }}
                size="xs"
              />
            </Stack>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              mt={4}
              onClick={() => {
                onDataChange(node.id, 'parameters', parameters.filter((_, idx) => idx !== i));
              }}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            onDataChange(node.id, 'parameters', [
              ...parameters,
              { name: '', type: 'string', description: '', required: false },
            ]);
          }}
        >
          {t('workflow.properties.extractor.addParam')}
        </Button>
      </Stack>
    </>
  );
}
