import { useState } from 'react';
import {
  Popover,
  ActionIcon,
  Text,
  Group,
  Stack,
  Switch,
  Slider,
  NumberInput,
  Select,
  TagsInput,
  SegmentedControl,
  Tooltip,
  Box,
  Divider,
} from '@mantine/core';
import { IconAdjustmentsHorizontal, IconX, IconHelpCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ModelSelect } from '@/components/Common/ModelSelect';

interface ModelSettingsPopoverProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
}

export function ModelSettingsPopover({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
}: ModelSettingsPopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  // Helper states for switches to enable/disable parameters
  const [tempEnabled, setTempEnabled] = useState(node.data.temperature !== undefined);
  const [topPEnabled, setTopPEnabled] = useState(node.data.top_p !== undefined);
  const [maxTokensEnabled, setMaxTokensEnabled] = useState(node.data.max_tokens !== undefined);
  const [jsonEnabled, setJsonEnabled] = useState(node.data.json_mode !== undefined);
  const [stopEnabled, setStopEnabled] = useState(node.data.stop_sequences !== undefined);

  const handleTempToggle = (checked: boolean) => {
    setTempEnabled(checked);
    if (checked) {
      onDataChange(node.id, 'temperature', 0.7);
    } else {
      onDataChange(node.id, 'temperature', undefined);
    }
  };

  const handleTopPToggle = (checked: boolean) => {
    setTopPEnabled(checked);
    if (checked) {
      onDataChange(node.id, 'top_p', 0.7);
    } else {
      onDataChange(node.id, 'top_p', undefined);
    }
  };

  const handleMaxTokensToggle = (checked: boolean) => {
    setMaxTokensEnabled(checked);
    if (checked) {
      onDataChange(node.id, 'max_tokens', 1024);
    } else {
      onDataChange(node.id, 'max_tokens', undefined);
    }
  };

  const handleJsonToggle = (checked: boolean) => {
    setJsonEnabled(checked);
    if (checked) {
      onDataChange(node.id, 'json_mode', true);
    } else {
      onDataChange(node.id, 'json_mode', undefined);
    }
  };

  const handleStopToggle = (checked: boolean) => {
    setStopEnabled(checked);
    if (checked) {
      onDataChange(node.id, 'stop_sequences', []);
    } else {
      onDataChange(node.id, 'stop_sequences', undefined);
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="left-start"
      withArrow
      shadow="md"
      width={360}
      styles={{
        dropdown: {
          padding: '12px',
          backgroundColor: 'var(--flock-bg-surface)',
          border: '1px solid var(--flock-border-subtle)',
        },
      }}
    >
      <Popover.Target>
        <ActionIcon
          variant="light"
          size="md"
          color="gray"
          onClick={() => setOpened((o) => !o)}
          style={{ alignSelf: 'flex-end', height: '32px', width: '32px' }}
        >
          <IconAdjustmentsHorizontal size={18} />
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm">
          {/* Header */}
          <Group justify="space-between">
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
              {t('workflow.properties.llm.modelSettings', 'Model Settings')}
            </Text>
            <ActionIcon variant="transparent" size="xs" color="gray" onClick={() => setOpened(false)}>
              <IconX size={14} />
            </ActionIcon>
          </Group>

          {/* Model Select */}
          <ModelSelect
            placeholder={t('workflow.properties.llm.modelPlaceholder')}
            data={modelOptions}
            disabled={modelsLoading}
            value={String(node.data.model ?? '')}
            onChange={(v) => {
              onDataChange(node.id, 'model', v);
              const allItems = modelOptions.flatMap((d: any) => d.items ? d.items : [d]);
              const matched = allItems.find(item => item.value === v);
              if (matched?.providerName) {
                onDataChange(node.id, 'provider', matched.providerName);
              }
            }}
            searchable
            clearable
            size="xs"
          />

          <Divider my={4} />

          <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: '0.5px' }}>
            {t('workflow.properties.llm.parameters', 'PARAMETERS')}
          </Text>

          {/* Temperature */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Group gap={4}>
                <Switch
                  checked={tempEnabled}
                  onChange={(e) => handleTempToggle(e.currentTarget.checked)}
                  size="xs"
                />
                <Text size="xs" fw={500}>
                  {t('workflow.properties.llm.temperature', 'Temperature')}
                </Text>
                <Tooltip label={t('workflow.properties.llm.tempDesc', 'Controls randomness: Lowering results in less random completions.')}>
                  <Box style={{ display: 'flex', alignItems: 'center', cursor: 'help' }}>
                    <IconHelpCircle size={12} color="var(--mantine-color-gray-5)" />
                  </Box>
                </Tooltip>
              </Group>
              {tempEnabled && (
                <NumberInput
                  value={Number(node.data.temperature ?? 0.7)}
                  onChange={(v) => onDataChange(node.id, 'temperature', Number(v))}
                  min={0}
                  max={2}
                  step={0.1}
                  decimalScale={1}
                  size="xs"
                  style={{ width: 60 }}
                  variant="filled"
                  styles={{ input: { textAlign: 'center', padding: 0 } }}
                />
              )}
            </Group>
            {tempEnabled && (
              <Box px={6}>
                <Slider
                  value={Number(node.data.temperature ?? 0.7)}
                  onChange={(v) => onDataChange(node.id, 'temperature', v)}
                  min={0}
                  max={2}
                  step={0.1}
                  label={null}
                  size="xs"
                />
              </Box>
            )}
          </Stack>

          {/* Top P */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Group gap={4}>
                <Switch
                  checked={topPEnabled}
                  onChange={(e) => handleTopPToggle(e.currentTarget.checked)}
                  size="xs"
                />
                <Text size="xs" fw={500}>
                  Top P
                </Text>
                <Tooltip label={t('workflow.properties.llm.topPDesc', 'Controls diversity via nucleus sampling.')}>
                  <Box style={{ display: 'flex', alignItems: 'center', cursor: 'help' }}>
                    <IconHelpCircle size={12} color="var(--mantine-color-gray-5)" />
                  </Box>
                </Tooltip>
              </Group>
              {topPEnabled && (
                <NumberInput
                  value={Number(node.data.top_p ?? 0.7)}
                  onChange={(v) => onDataChange(node.id, 'top_p', Number(v))}
                  min={0}
                  max={1}
                  step={0.05}
                  decimalScale={2}
                  size="xs"
                  style={{ width: 60 }}
                  variant="filled"
                  styles={{ input: { textAlign: 'center', padding: 0 } }}
                />
              )}
            </Group>
            {topPEnabled && (
              <Box px={6}>
                <Slider
                  value={Number(node.data.top_p ?? 0.7)}
                  onChange={(v) => onDataChange(node.id, 'top_p', v)}
                  min={0}
                  max={1}
                  step={0.05}
                  label={null}
                  size="xs"
                />
              </Box>
            )}
          </Stack>

          {/* Max Tokens */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Group gap={4}>
                <Switch
                  checked={maxTokensEnabled}
                  onChange={(e) => handleMaxTokensToggle(e.currentTarget.checked)}
                  size="xs"
                />
                <Text size="xs" fw={500}>
                  {t('workflow.properties.llm.maxTokens', 'Max Tokens')}
                </Text>
              </Group>
              {maxTokensEnabled && (
                <NumberInput
                  value={Number(node.data.max_tokens ?? 1024)}
                  onChange={(v) => onDataChange(node.id, 'max_tokens', Number(v))}
                  min={1}
                  max={16384}
                  step={128}
                  size="xs"
                  style={{ width: 60 }}
                  variant="filled"
                  styles={{ input: { textAlign: 'center', padding: 0 } }}
                />
              )}
            </Group>
            {maxTokensEnabled && (
              <Box px={6}>
                <Slider
                  value={Number(node.data.max_tokens ?? 1024)}
                  onChange={(v) => onDataChange(node.id, 'max_tokens', v)}
                  min={1}
                  max={4096}
                  step={64}
                  label={null}
                  size="xs"
                />
              </Box>
            )}
          </Stack>

          {/* JSON Mode / Reply Format */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Group gap={4}>
                <Switch
                  checked={jsonEnabled}
                  onChange={(e) => handleJsonToggle(e.currentTarget.checked)}
                  size="xs"
                />
                <Text size="xs" fw={500}>
                  {t('workflow.properties.llm.jsonMode', 'JSON Mode')}
                </Text>
              </Group>
              {jsonEnabled && (
                <Select
                  data={['JSON Object', 'JSON Schema']}
                  value="JSON Object"
                  size="xs"
                  style={{ width: 120 }}
                  variant="filled"
                  readOnly
                />
              )}
            </Group>
          </Stack>

          {/* Stop Sequences */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Group gap={4}>
                <Switch
                  checked={stopEnabled}
                  onChange={(e) => handleStopToggle(e.currentTarget.checked)}
                  size="xs"
                />
                <Text size="xs" fw={500}>
                  {t('workflow.properties.llm.stopSequences', 'Stop Sequences')}
                </Text>
              </Group>
            </Group>
            {stopEnabled && (
              <TagsInput
                placeholder={t('workflow.properties.llm.stopSequencesPlaceholder', 'Enter tag and press Tab')}
                value={(node.data.stop_sequences as string[]) ?? []}
                onChange={(tags) => onDataChange(node.id, 'stop_sequences', tags)}
                size="xs"
              />
            )}
          </Stack>

        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
