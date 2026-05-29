import { Group, Stack, TextInput, ActionIcon, Button, Divider, Switch, NumberInput, Select } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VariableTextarea } from '../VariableInput';

export interface HumanFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function HumanFields({ node, onDataChange }: HumanFieldsProps) {
  const { t } = useTranslation();

  // Submission types (default to true for Webapp)
  const isWebapp = node.data.webapp_enabled !== false;

  // Actions list, defaults to action_1: Approve, action_2: Reject
  const actions = (node.data.user_actions as { key: string; label: string }[]) ?? [
    { key: 'action_1', label: t('workflow.properties.human.approve', 'Approve') },
    { key: 'action_2', label: t('workflow.properties.human.reject', 'Reject') },
  ];

  // Timeout settings
  const timeoutNum = node.data.timeout_num ?? 3;
  const timeoutUnit = node.data.timeout_unit ?? 'hours';

  const handleActionChange = (index: number, label: string) => {
    const next = [...actions];
    next[index] = { ...next[index], label };
    onDataChange(node.id, 'user_actions', next);
  };

  const handleAddAction = () => {
    const nextKey = `action_${actions.length + 1}`;
    onDataChange(node.id, 'user_actions', [...actions, { key: nextKey, label: '' }]);
  };

  const handleRemoveAction = (index: number) => {
    const next = actions.filter((_, i) => i !== index);
    onDataChange(node.id, 'user_actions', next);
  };

  return (
    <Stack gap="sm">
      {/* Submission Method */}
      <Divider label={t('workflow.properties.human.submissionMethod', 'Submission Method')} labelPosition="center" />
      <Group justify="space-between">
        <Group gap="xs">
          <span>🤖</span>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Webapp</span>
        </Group>
        <Switch
          checked={isWebapp}
          onChange={(e) => onDataChange(node.id, 'webapp_enabled', e.currentTarget.checked)}
          size="xs"
        />
      </Group>

      {/* Form Content Template */}
      <Divider label={t('workflow.properties.human.formContent', 'Form Content')} labelPosition="center" />
      <VariableTextarea
        label={t('workflow.properties.human.formDescription', 'Please write instructions or form content for the user')}
        placeholder={t('workflow.properties.human.formPlaceholder', 'Please approve the drafted content')}
        value={String(node.data.form_content ?? node.data.title ?? '')}
        currentNodeId={node.id}
        onChange={(val) => {
          onDataChange(node.id, 'form_content', val);
          onDataChange(node.id, 'title', val); // Keep title synchronized for backward compatibility
        }}
        minRows={4}
        size="xs"
      />

      {/* User Actions Buttons */}
      <Divider label={t('workflow.properties.human.userActions', 'User Actions')} labelPosition="center" />
      <Stack gap={4}>
        {actions.map((act, i) => (
          <Group key={act.key} gap={4}>
            <TextInput
              placeholder={act.key}
              value={act.label}
              onChange={(e) => handleActionChange(i, e.target.value)}
              size="xs"
              style={{ flex: 1 }}
            />
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={() => handleRemoveAction(i)}
              disabled={actions.length <= 1}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={handleAddAction}
        >
          {t('workflow.properties.human.addAction', 'Add Action')}
        </Button>
      </Stack>

      {/* Timeout Configuration */}
      <Divider label={t('workflow.properties.human.timeoutSettings', 'Timeout Settings')} labelPosition="center" />
      <Group gap="xs" grow>
        <NumberInput
          value={timeoutNum}
          onChange={(v) => onDataChange(node.id, 'timeout_num', Number(v))}
          min={1}
          size="xs"
        />
        <Select
          data={[
            { value: 'minutes', label: t('workflow.properties.human.minutes', 'Minutes') },
            { value: 'hours', label: t('workflow.properties.human.hours', 'Hours') },
            { value: 'days', label: t('workflow.properties.human.days', 'Days') },
          ]}
          value={timeoutUnit}
          onChange={(v) => onDataChange(node.id, 'timeout_unit', v)}
          size="xs"
        />
      </Group>
    </Stack>
  );
}
