import { type Node } from 'reactflow';
import { useRef, useState, useMemo } from 'react';
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
  MultiSelect,
  Stack,
  Divider,
  ThemeIcon,
  Badge,
  Button,
  Popover,
  Tooltip,
} from '@mantine/core';
import { IconX, IconPlus, IconTrash, IconBolt } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '../nodeConfig';
import { v4 as uuidv4 } from 'uuid';
import { useAvailableModels } from '../../../hooks/useAvailableModels';
import { useAvailableTools } from '../../../hooks/useAvailableTools';
import { useWorkflowStore } from '../../../store/workflowStore';

// ── Variable Interpolation Support ──────────────────────────────────────────

interface VariableOption {
  label: string;
  value: string;
  nodeId: string;
  nodeName: string;
}

function getAvailableVariables(currentNodeId: string, nodes: Node[]): VariableOption[] {
  const vars: VariableOption[] = [];
  nodes.forEach((node) => {
    if (node.id === currentNodeId) return;
    const nodeLabel = String(node.data?.label || node.id);
    const nodeType = node.type;

    if (nodeType === 'start') {
      vars.push({
        label: `${nodeLabel} (query)`,
        value: `\${${node.id}.query}`,
        nodeId: node.id,
        nodeName: nodeLabel,
      });
    } else if (nodeType === 'classifier') {
      vars.push({
        label: `${nodeLabel} (category_id)`,
        value: `\${${node.id}.category_id}`,
        nodeId: node.id,
        nodeName: nodeLabel,
      });
    } else if (nodeType === 'parameterExtractor') {
      const parameters = node.data?.parameters as Array<{ name: string }> | undefined;
      if (parameters && parameters.length > 0) {
        parameters.forEach((p) => {
          if (p.name) {
            vars.push({
              label: `${nodeLabel} (${p.name})`,
              value: `\${${node.id}.${p.name}}`,
              nodeId: node.id,
              nodeName: nodeLabel,
            });
          }
        });
      } else {
        vars.push({
          label: `${nodeLabel} (response)`,
          value: `\${${node.id}.response}`,
          nodeId: node.id,
          nodeName: nodeLabel,
        });
      }
    } else {
      vars.push({
        label: `${nodeLabel} (response)`,
        value: `\${${node.id}.response}`,
        nodeId: node.id,
        nodeName: nodeLabel,
      });
    }
  });
  return vars;
}

interface VariableTextInputProps extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'onChange'> {
  currentNodeId: string;
  onChange: (val: string) => void;
}

function VariableTextInput({ currentNodeId, onChange, value, ...props }: VariableTextInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverOpened, setPopoverOpened] = useState(false);
  const nodes = useWorkflowStore((s) => s.nodes);

  const variables = useMemo(() => getAvailableVariables(currentNodeId, nodes), [currentNodeId, nodes]);

  const insertVariable = (varValue: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentText = String(value ?? '');

    let textToInsert = varValue;
    let newStart = start;
    if (start > 0 && currentText[start - 1] === '/') {
      newStart = start - 1;
    }

    const nextText = currentText.substring(0, newStart) + textToInsert + currentText.substring(end);

    onChange(nextText);
    setPopoverOpened(false);

    setTimeout(() => {
      input.focus();
      const nextCursorPos = newStart + textToInsert.length;
      input.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (props.onKeyDown) props.onKeyDown(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '/') {
      setPopoverOpened(true);
    }
  };

  const groupedVars = useMemo(() => {
    const acc: Record<string, typeof variables> = {};
    variables.forEach((v) => {
      (acc[v.nodeName] = acc[v.nodeName] || []).push(v);
    });
    return acc;
  }, [variables]);

  return (
    <Popover
      opened={popoverOpened && variables.length > 0}
      onChange={setPopoverOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <TextInput
          {...props}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          rightSection={
            variables.length > 0 && (
              <Tooltip label={t('workflow.properties.insertVar', { defaultValue: '插入前序变量 (输入 /)' })} position="top">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="blue"
                  onClick={() => setPopoverOpened((o) => !o)}
                  style={{
                    color: popoverOpened ? 'var(--flock-accent)' : 'var(--mantine-color-dimmed)',
                    transition: 'all 0.2s',
                  }}
                >
                  <IconBolt size={14} />
                </ActionIcon>
              </Tooltip>
            )
          }
        />
      </Popover.Target>
      <Popover.Dropdown p="xs" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)', minWidth: 220, maxHeight: 250, overflowY: 'auto' }}>
        <Text size="xs" fw={600} mb="xs" c="dimmed">
          {t('workflow.properties.availableVars', { defaultValue: '选择前序节点输出参数' })}
        </Text>
        <Stack gap={6}>
          {Object.entries(groupedVars).map(([nodeName, vars]) => (
            <Box key={nodeName}>
              <Text size="10px" fw={700} c="dimmed" mb={4} style={{ letterSpacing: '0.5px' }}>
                {nodeName}
              </Text>
              <Stack gap={2}>
                {vars.map((v) => (
                  <Button
                    key={v.value}
                    size="xs"
                    variant="subtle"
                    justify="flex-start"
                    onClick={() => insertVariable(v.value)}
                    styles={{
                      root: {
                        height: 'auto',
                        padding: '4px 6px',
                        textAlign: 'left',
                        color: 'var(--flock-text-bright)',
                      },
                      inner: {
                        justifyContent: 'flex-start',
                      }
                    }}
                  >
                    <Text size="xs" style={{ fontFamily: 'monospace' }}>
                      {v.value.substring(2, v.value.length - 1).split('.')[1]}
                    </Text>
                  </Button>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

interface VariableTextareaProps extends Omit<React.ComponentPropsWithoutRef<typeof Textarea>, 'onChange'> {
  currentNodeId: string;
  onChange: (val: string) => void;
}

function VariableTextarea({ currentNodeId, onChange, value, ...props }: VariableTextareaProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popoverOpened, setPopoverOpened] = useState(false);
  const nodes = useWorkflowStore((s) => s.nodes);

  const variables = useMemo(() => getAvailableVariables(currentNodeId, nodes), [currentNodeId, nodes]);

  const insertVariable = (varValue: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentText = String(value ?? '');

    let textToInsert = varValue;
    let newStart = start;
    if (start > 0 && currentText[start - 1] === '/') {
      newStart = start - 1;
    }

    const nextText = currentText.substring(0, newStart) + textToInsert + currentText.substring(end);

    onChange(nextText);
    setPopoverOpened(false);

    setTimeout(() => {
      textarea.focus();
      const nextCursorPos = newStart + textToInsert.length;
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (props.onKeyDown) props.onKeyDown(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/') {
      setPopoverOpened(true);
    }
  };

  const groupedVars = useMemo(() => {
    const acc: Record<string, typeof variables> = {};
    variables.forEach((v) => {
      (acc[v.nodeName] = acc[v.nodeName] || []).push(v);
    });
    return acc;
  }, [variables]);

  return (
    <Popover
      opened={popoverOpened && variables.length > 0}
      onChange={setPopoverOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Box style={{ position: 'relative' }}>
          <Textarea
            {...props}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            style={{ width: '100%' }}
          />
          {variables.length > 0 && (
            <div style={{ position: 'absolute', right: 8, top: 4, zIndex: 2 }}>
              <Tooltip label={t('workflow.properties.insertVar', { defaultValue: '插入前序变量 (输入 /)' })} position="top">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="blue"
                  onClick={() => setPopoverOpened((o) => !o)}
                  style={{
                    color: popoverOpened ? 'var(--flock-accent)' : 'var(--mantine-color-dimmed)',
                    transition: 'all 0.2s',
                  }}
                >
                  <IconBolt size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </Box>
      </Popover.Target>
      <Popover.Dropdown p="xs" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)', minWidth: 220, maxHeight: 250, overflowY: 'auto' }}>
        <Text size="xs" fw={600} mb="xs" c="dimmed">
          {t('workflow.properties.availableVars', { defaultValue: '选择前序节点输出参数' })}
        </Text>
        <Stack gap={6}>
          {Object.entries(groupedVars).map(([nodeName, vars]) => (
            <Box key={nodeName}>
              <Text size="10px" fw={700} c="dimmed" mb={4} style={{ letterSpacing: '0.5px' }}>
                {nodeName}
              </Text>
              <Stack gap={2}>
                {vars.map((v) => (
                  <Button
                    key={v.value}
                    size="xs"
                    variant="subtle"
                    justify="flex-start"
                    onClick={() => insertVariable(v.value)}
                    styles={{
                      root: {
                        height: 'auto',
                        padding: '4px 6px',
                        textAlign: 'left',
                        color: 'var(--flock-text-bright)',
                      },
                      inner: {
                        justifyContent: 'flex-start',
                      }
                    }}
                  >
                    <Text size="xs" style={{ fontFamily: 'monospace' }}>
                      {v.value.substring(2, v.value.length - 1).split('.')[1]}
                    </Text>
                  </Button>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

interface PropertiesPanelProps {
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
          <NodeSpecificFields
            node={node}
            onDataChange={onDataChange}
            modelOptions={modelOptions}
            modelsLoading={modelsLoading}
            toolOptions={toolOptions}
            toolsLoading={toolsLoading}
          />
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

interface NodeSpecificFieldsProps extends FieldsProps {
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
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
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
        <VariableTextarea
          label={t('workflow.properties.human.title')}
          placeholder={t('workflow.properties.human.titlePlaceholder')}
          value={String(node.data.title ?? '')}
          currentNodeId={node.id}
          onChange={(val) => onDataChange(node.id, 'title', val)}
          minRows={2}
          size="xs"
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

// ── LLM fields ──────────────────────────────────────────────────────────────

interface ModelFieldsProps extends FieldsProps {
  modelOptions: any[];
  modelsLoading: boolean;
}

function LLMFields({ node, onDataChange, modelOptions, modelsLoading }: ModelFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Select
        label={t('workflow.properties.llm.model')}
        placeholder={t('workflow.properties.llm.modelPlaceholder')}
        data={modelOptions}
        disabled={modelsLoading}
        value={String(node.data.model ?? '')}
        onChange={(v) => onDataChange(node.id, 'model', v)}
        searchable
        clearable
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
      <VariableTextarea
        label={t('workflow.properties.llm.systemPrompt')}
        placeholder={t('workflow.properties.llm.systemPromptPlaceholder')}
        value={String(node.data.systemMessage ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'systemMessage', val)}
        minRows={3}
        size="xs"
      />
      <VariableTextarea
        label={t('workflow.properties.llm.userPrompt')}
        placeholder="${start.query}"
        value={String(node.data.userMessage ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'userMessage', val)}
        minRows={3}
        size="xs"
      />
    </>
  );
}

// ── Agent fields ─────────────────────────────────────────────────────────────

interface AgentFieldsProps extends ModelFieldsProps {
  toolOptions: any[];
  toolsLoading: boolean;
}

function AgentFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
  toolOptions,
  toolsLoading,
}: AgentFieldsProps) {
  const { t } = useTranslation();
  const tools = (node.data.tools as string[]) ?? [];

  return (
    <>
      <LLMFields
        node={node}
        onDataChange={onDataChange}
        modelOptions={modelOptions}
        modelsLoading={modelsLoading}
      />
      <Divider label={t('workflow.properties.agent.tools')} labelPosition="center" />
      <MultiSelect
        label={t('workflow.properties.agent.toolsSelect')}
        placeholder={t('workflow.properties.agent.toolsPlaceholder')}
        data={toolOptions}
        disabled={toolsLoading}
        value={tools}
        onChange={(v) => onDataChange(node.id, 'tools', v)}
        searchable
        clearable
        size="xs"
      />
    </>
  );
}

// ── Classifier fields ─────────────────────────────────────────────────────────

function ClassifierFields({ node, onDataChange, modelOptions, modelsLoading }: ModelFieldsProps) {
  const { t } = useTranslation();
  const categories = (node.data.categories as { category_id: string; category_name: string }[]) ?? [];

  return (
    <>
      <VariableTextInput
        label={t('workflow.properties.classifier.input')}
        placeholder="${start.query}"
        value={String(node.data.input ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'input', val)}
        size="xs"
      />
      <Select
        label={t('workflow.properties.llm.model')}
        placeholder={t('workflow.properties.llm.modelPlaceholder')}
        data={modelOptions}
        disabled={modelsLoading}
        value={String(node.data.model ?? '')}
        onChange={(v) => onDataChange(node.id, 'model', v)}
        searchable
        clearable
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

function ParameterExtractorFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
}: ModelFieldsProps) {
  const { t } = useTranslation();
  const parameters = (node.data.parameters as { name: string; type: string; description: string; required: boolean }[]) ?? [];

  return (
    <>
      <Select
        label={t('workflow.properties.llm.model')}
        placeholder={t('workflow.properties.llm.modelPlaceholder')}
        data={modelOptions}
        disabled={modelsLoading}
        value={String(node.data.model ?? '')}
        onChange={(v) => onDataChange(node.id, 'model', v)}
        searchable
        clearable
        size="xs"
      />
      <VariableTextInput
        label={t('workflow.properties.extractor.input')}
        placeholder="${start.query}"
        value={String(node.data.input ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'input', val)}
        size="xs"
      />
      <VariableTextarea
        label={t('workflow.properties.extractor.instruction')}
        value={String(node.data.instruction ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'instruction', val)}
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
