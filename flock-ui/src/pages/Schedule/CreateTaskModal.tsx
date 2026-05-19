import {
  Modal,
  ThemeIcon,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  ScrollArea,
  Box,
  Tooltip,
  UnstyledButton,
  Badge,
} from '@mantine/core';
import {
  IconCalendarTime,
  IconPlus,
  IconCheck,
  IconEdit,
  IconHelpCircle,
  IconClock,
  IconCalendar,
  IconCalendarWeek,
  IconClick,
  IconCode,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useCronForm, WEEKDAY_OPTIONS, type SchedulePreset } from '../../hooks/useCronForm';
import type { CronJob } from './types';

interface CreateTaskModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobToEdit?: CronJob | null;
}

interface ScheduleOption {
  value: SchedulePreset;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
  badge?: string;
}

const SCHEDULE_OPTIONS: ScheduleOption[] = [
  { value: 'manual',   labelKey: 'schedule.presetManual',   descKey: 'schedule.presetManualDesc',   icon: <IconClick size={16} /> },
  { value: 'hourly',   labelKey: 'schedule.presetHourly',   descKey: 'schedule.presetHourlyDesc',   icon: <IconClock size={16} />,       badge: '0 * * * *' },
  { value: 'daily',    labelKey: 'schedule.presetDaily',    descKey: 'schedule.presetDailyDesc',    icon: <IconCalendar size={16} /> },
  { value: 'weekdays', labelKey: 'schedule.presetWeekdays', descKey: 'schedule.presetWeekdaysDesc', icon: <IconCalendarWeek size={16} />, badge: '1-5' },
  { value: 'weekly',   labelKey: 'schedule.presetWeekly',   descKey: 'schedule.presetWeeklyDesc',   icon: <IconCalendarTime size={16} /> },
  { value: 'custom',   labelKey: 'schedule.presetCustom',   descKey: 'schedule.presetCustomDesc',   icon: <IconCode size={16} />,        badge: 'Cron' },
];

const inputStyle = {
  input: {
    background: 'var(--flock-bg-surface)',
    border: '1px solid var(--flock-border-dim)',
  },
  dropdown: {
    background: 'var(--flock-bg-raised)',
    border: '1px solid var(--flock-border-dim)',
  },
};

/** 仅用于 执行模式 和 Cron 表达式 这两处需要解释的字段 */
function LabelWithTip({ label, tip }: { label: string; tip: string }) {
  return (
    <Group gap={5} wrap="nowrap" mb={4}>
      <Text size="sm" fw={500}>{label}</Text>
      <Tooltip label={tip} multiline w={230} withArrow position="top">
        <IconHelpCircle size={13} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
      </Tooltip>
    </Group>
  );
}

export function CreateTaskModal({ opened, onClose, onSuccess, jobToEdit }: CreateTaskModalProps) {
  const { t } = useTranslation();
  const isEditing = !!jobToEdit;

  const form = useCronForm({ opened, jobToEdit, onSuccess, onClose });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="md" radius="md">
            {isEditing ? <IconEdit size={16} /> : <IconPlus size={16} />}
          </ThemeIcon>
          <Text fw={700} size="md">
            {isEditing ? t('schedule.editTitle') : t('schedule.createTitle')}
          </Text>
        </Group>
      }
      size="lg"
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
        },
      }}
    >
      <ScrollArea mah="76vh" offsetScrollbars>
        <Stack gap="md" pt="xs" pb="xl" px="xs">

          {/* 工作空间 */}
          <Select
            label={t('schedule.workspace')}
            placeholder={t('schedule.workspacePlaceholder')}
            value={form.workspaceId}
            onChange={form.setWorkspaceId}
            data={form.workspaces.map(w => ({ value: w.id, label: w.name }))}
            styles={inputStyle}
          />

          {/* 任务名称 */}
          <TextInput
            label={t('schedule.taskName')}
            placeholder={t('schedule.taskNamePlaceholder')}
            value={form.name}
            onChange={e => form.setName(e.currentTarget.value)}
            styles={inputStyle}
          />

          {/* 任务描述 */}
          <Textarea
            label={t('schedule.description')}
            placeholder={t('schedule.descriptionPlaceholder')}
            value={form.description}
            onChange={e => form.setDescription(e.currentTarget.value)}
            rows={2}
            styles={inputStyle}
          />

          {/* 执行助手 + 执行模式（模式有 tooltip） */}
          <Group grow align="flex-start">
            <Select
              label={t('schedule.assistant')}
              value={form.assistantId}
              onChange={form.setAssistantId}
              data={form.assistants.map(a => ({ value: a.id, label: `${a.icon} ${a.name}` }))}
              styles={inputStyle}
            />
            <Select
              label={
                <LabelWithTip
                  label={t('schedule.executionMode')}
                  tip={t('schedule.executionModeTip')}
                />
              }
              value={form.executionMode}
              onChange={v => form.setExecutionMode((v as any) || 'new_conversation')}
              data={[
                { value: 'new_conversation', label: t('schedule.modeNew') },
                { value: 'existing',         label: t('schedule.modeExisting') },
              ]}
              styles={inputStyle}
            />
          </Group>

          {/* 执行指令 */}
          <Textarea
            label={t('schedule.prompt')}
            placeholder={t('schedule.promptPlaceholder')}
            value={form.prompt}
            onChange={e => form.setPrompt(e.currentTarget.value)}
            minRows={4}
            autosize
            styles={{
              input: {
                ...inputStyle.input,
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 12,
                lineHeight: 1.6,
              },
            }}
          />

          <Divider color="var(--flock-border-subtle)" />

          {/* 调度频率：卡片单选组（3列） */}
          <Stack gap={8}>
            <Text size="sm" fw={500}>{t('schedule.frequency')}</Text>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {SCHEDULE_OPTIONS.map(opt => {
                const active = form.schedulePreset === opt.value;
                return (
                  <UnstyledButton
                    key={opt.value}
                    onClick={() => form.setSchedulePreset(opt.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${active ? 'var(--flock-accent)' : 'var(--flock-border-dim)'}`,
                      background: active ? 'rgba(21, 90, 239, 0.08)' : 'var(--flock-bg-surface)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <Group gap={5} wrap="nowrap" mb={3}>
                      <Box style={{ color: active ? 'var(--flock-accent)' : 'var(--flock-text-dim)', flexShrink: 0 }}>
                        {opt.icon}
                      </Box>
                      <Text size="xs" fw={active ? 700 : 500} style={{ color: active ? 'var(--flock-text-bright)' : 'var(--flock-text-muted)' }} truncate>
                        {t(opt.labelKey)}
                      </Text>
                      {opt.badge && (
                        <Badge size="xs" variant="light" color={active ? 'blue' : 'gray'} radius="sm" style={{ marginLeft: 'auto', fontSize: 9, flexShrink: 0 }}>
                          {opt.badge}
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10, lineHeight: 1.3 }}>
                      {t(opt.descKey)}
                    </Text>
                  </UnstyledButton>
                );
              })}
            </div>
          </Stack>

          {/* 附加配置：daily / weekdays */}
          {(form.schedulePreset === 'daily' || form.schedulePreset === 'weekdays') && (
            <TextInput
              label={form.schedulePreset === 'daily' ? t('schedule.dailyTime') : t('schedule.weekdaysTime')}
              placeholder="09:00"
              value={form.dailyTime}
              onChange={e => form.setDailyTime(e.currentTarget.value)}
              styles={inputStyle}
            />
          )}

          {/* 附加配置：weekly */}
          {form.schedulePreset === 'weekly' && (
            <Group grow align="flex-start">
              <Select
                label={t('schedule.weeklyDay')}
                value={form.weeklyDay}
                onChange={v => form.setWeeklyDay(v || '1')}
                data={WEEKDAY_OPTIONS}
                styles={inputStyle}
              />
              <TextInput
                label={t('schedule.weeklyTime')}
                placeholder="09:00"
                value={form.weeklyTime}
                onChange={e => form.setWeeklyTime(e.currentTarget.value)}
                styles={inputStyle}
              />
            </Group>
          )}

          {/* 附加配置：custom Cron（有 tooltip） */}
          {form.schedulePreset === 'custom' && (
            <TextInput
              label={
                <LabelWithTip
                  label={t('schedule.cronExpr')}
                  tip={t('schedule.cronExprTip')}
                />
              }
              placeholder="0 9 * * *"
              value={form.customCron}
              onChange={e => form.setCustomCron(e.currentTarget.value)}
              styles={{
                input: {
                  ...inputStyle.input,
                  fontFamily: 'var(--mantine-font-family-monospace)',
                },
              }}
            />
          )}

        </Stack>
      </ScrollArea>

      <Divider color="var(--flock-border-subtle)" />
      <Group justify="flex-end" pt="md" px="xs">
        <Button variant="subtle" onClick={onClose} disabled={form.loading}>
          {t('common.cancel')}
        </Button>
        <Button
          color="blue"
          loading={form.loading}
          disabled={!form.name.trim() || !form.prompt.trim() || !form.workspaceId}
          leftSection={isEditing ? <IconCheck size={16} /> : <IconPlus size={16} />}
          onClick={form.handleSubmit}
          style={{ background: 'var(--flock-accent)' }}
        >
          {isEditing ? t('common.saveChanges') : t('schedule.createBtn')}
        </Button>
      </Group>
    </Modal>
  );
}
