import { useState, useEffect } from 'react';
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
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import type { CronJob } from './types';

interface Assistant {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface CreateTaskModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobToEdit?: CronJob | null;
}

const WEEKDAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' },
];

type SchedulePreset = 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'custom';

interface ScheduleOption {
  value: SchedulePreset;
  label: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}

const SCHEDULE_OPTIONS: ScheduleOption[] = [
  { value: 'manual',   label: '手动触发',   desc: '仅在您点击"立即执行"时运行', icon: <IconClick size={16} />, },
  { value: 'hourly',   label: '每小时',     desc: '每整点自动执行一次',          icon: <IconClock size={16} />, badge: '0 * * * *' },
  { value: 'daily',    label: '每天定时',   desc: '在您指定的时间每天执行',       icon: <IconCalendar size={16} /> },
  { value: 'weekdays', label: '工作日',     desc: '周一至周五每天定时执行',       icon: <IconCalendarWeek size={16} />, badge: '1-5' },
  { value: 'weekly',   label: '每周',       desc: '指定星期几定时执行',           icon: <IconCalendarTime size={16} /> },
  { value: 'custom',   label: '自定义',     desc: '输入标准 5 字段 Cron 表达式',  icon: <IconCode size={16} />, badge: 'Cron' },
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

/** 与 SystemSettings 一致的带 tooltip 的字段标签 */
function FieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Group gap={6} wrap="nowrap" mb={4}>
      <Text size="sm" fw={500}>{label}</Text>
      <Tooltip label={tooltip} multiline w={220} withArrow position="top">
        <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
      </Tooltip>
    </Group>
  );
}

export function CreateTaskModal({ opened, onClose, onSuccess, jobToEdit }: CreateTaskModalProps) {
  const { data: workspaces = [] } = useWorkspacesQuery();
  const isEditing = !!jobToEdit;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'new_conversation' | 'existing'>('new_conversation');
  const [prompt, setPrompt] = useState('');

  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('manual');
  const [dailyTime, setDailyTime] = useState('09:00');
  const [weeklyDay, setWeeklyDay] = useState('1');
  const [weeklyTime, setWeeklyTime] = useState('09:00');
  const [customCron, setCustomCron] = useState('0 9 * * *');

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<Assistant[]>('list_assistants')
      .then((data) => {
        const list = [...data];
        if (!list.some(a => a.id === '__xiaof__')) {
          list.unshift({ id: '__xiaof__', name: '默认助手 (小F)', icon: '🤖', description: '' });
        }
        setAssistants(list);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!opened) return;
    if (jobToEdit) {
      setName(jobToEdit.name);
      setDescription(jobToEdit.description);
      setWorkspaceId(jobToEdit.workspace_id);
      setAssistantId(jobToEdit.assistant_id);
      setExecutionMode(jobToEdit.execution_mode as any);
      setPrompt(jobToEdit.prompt);

      const { schedule_kind, schedule_value } = jobToEdit;
      if (schedule_kind === 'manual') {
        setSchedulePreset('manual');
      } else if (schedule_kind === 'cron') {
        const parts = schedule_value.split(' ');
        if (parts.length === 5) {
          const [m, h, , , wd] = parts;
          if (h === '*') {
            setSchedulePreset('hourly');
          } else if (wd === '1-5') {
            setSchedulePreset('weekdays');
            setDailyTime(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
          } else if (/^\d$/.test(wd)) {
            setSchedulePreset('weekly');
            setWeeklyDay(wd);
            setWeeklyTime(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
          } else if (wd === '*') {
            setSchedulePreset('daily');
            setDailyTime(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
          } else {
            setSchedulePreset('custom');
            setCustomCron(schedule_value);
          }
        }
      }
    } else {
      setName('');
      setDescription('');
      setWorkspaceId(workspaces.length > 0 ? workspaces[0].id : null);
      setAssistantId(assistants.length > 0 ? assistants[0].id : null);
      setExecutionMode('new_conversation');
      setPrompt('');
      setSchedulePreset('manual');
      setDailyTime('09:00');
      setWeeklyDay('1');
      setWeeklyTime('09:00');
      setCustomCron('0 9 * * *');
    }
  }, [opened, jobToEdit]);

  useEffect(() => {
    if (!jobToEdit && workspaces.length > 0 && !workspaceId) setWorkspaceId(workspaces[0].id);
  }, [workspaces]);

  useEffect(() => {
    if (!jobToEdit && assistants.length > 0 && !assistantId) setAssistantId(assistants[0].id);
  }, [assistants]);

  const buildSchedule = () => {
    switch (schedulePreset) {
      case 'manual':   return { kind: 'manual', value: '', desc: '手动触发' };
      case 'hourly':   return { kind: 'cron', value: '0 * * * *', desc: '每小时整点' };
      case 'daily': {
        const [hh, mm] = dailyTime.split(':');
        return { kind: 'cron', value: `${parseInt(mm)} ${parseInt(hh)} * * *`, desc: `每天 ${dailyTime}` };
      }
      case 'weekdays': {
        const [hh, mm] = dailyTime.split(':');
        return { kind: 'cron', value: `${parseInt(mm)} ${parseInt(hh)} * * 1-5`, desc: `工作日 ${dailyTime}` };
      }
      case 'weekly': {
        const [hh, mm] = weeklyTime.split(':');
        const dayLabel = WEEKDAY_OPTIONS.find(d => d.value === weeklyDay)?.label || `星期${weeklyDay}`;
        return { kind: 'cron', value: `${parseInt(mm)} ${parseInt(hh)} * * ${weeklyDay}`, desc: `每周${dayLabel} ${weeklyTime}` };
      }
      case 'custom':   return { kind: 'cron', value: customCron.trim(), desc: `Cron: ${customCron.trim()}` };
      default:         return { kind: 'manual', value: '', desc: '手动触发' };
    }
  };

  const handleSubmit = async () => {
    if (!workspaceId) {
      notifications.show({ title: '提交失败', message: '请选择工作空间', color: 'red' }); return;
    }
    if (!name.trim()) {
      notifications.show({ title: '提交失败', message: '请输入任务名称', color: 'red' }); return;
    }
    if (!prompt.trim()) {
      notifications.show({ title: '提交失败', message: '请输入执行指令', color: 'red' }); return;
    }

    setLoading(true);
    const { kind, value, desc } = buildSchedule();
    const payload = {
      id: jobToEdit ? jobToEdit.id : null,
      name: name.trim(),
      description: description.trim(),
      enabled: jobToEdit ? jobToEdit.enabled : true,
      schedule_kind: kind,
      schedule_value: value,
      schedule_desc: desc,
      execution_mode: executionMode,
      prompt: prompt.trim(),
      workspace_id: workspaceId,
      assistant_id: assistantId || '__xiaof__',
    };

    try {
      if (isEditing) {
        await invoke('update_cron_job', { id: jobToEdit!.id, input: payload });
        notifications.show({ title: '已更新', message: '定时任务配置已保存', color: 'teal' });
      } else {
        await invoke('create_cron_job', { input: payload });
        notifications.show({ title: '已创建', message: '定时任务已成功建立', color: 'teal' });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      notifications.show({ title: '操作失败', message: String(e), color: 'red', autoClose: 8000 });
    } finally {
      setLoading(false);
    }
  };

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
            {isEditing ? '编辑定时自动化任务' : '创建定时自动化任务'}
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
      <ScrollArea mah="72vh" offsetScrollbars>
        <Stack gap="md" pt="xs" pb="xl" px="xs">

          {/* 第一步：工作空间 */}
          <Select
            label={
              <FieldLabel
                label="1. 工作空间 *"
                tooltip="定时任务执行时关联的物理工作目录，Agent 将在此工作区上下文中运行。"
              />
            }
            placeholder="选择关联工作区..."
            value={workspaceId}
            onChange={setWorkspaceId}
            data={workspaces.map(w => ({ value: w.id, label: w.name }))}
            styles={inputStyle}
          />

          {/* 任务名称 */}
          <TextInput
            label={
              <Group gap={6} wrap="nowrap" mb={4}>
                <Text size="sm" fw={500}>任务名称 <span style={{ color: '#f87171' }}>*</span></Text>
              </Group>
            }
            placeholder="例如：每日代码变更周报"
            value={name}
            onChange={e => setName(e.currentTarget.value)}
            styles={inputStyle}
          />

          {/* 描述 */}
          <Textarea
            label="任务描述"
            placeholder="可选：简要说明此任务的目的"
            value={description}
            onChange={e => setDescription(e.currentTarget.value)}
            rows={2}
            styles={inputStyle}
          />

          {/* 执行助手 + 执行模式 */}
          <Group grow align="flex-start">
            <Select
              label={
                <FieldLabel
                  label="执行助手 *"
                  tooltip="选择执行此定时任务的 AI 助手。不同助手有不同的工具集和系统提示词。"
                />
              }
              value={assistantId}
              onChange={setAssistantId}
              data={assistants.map(a => ({ value: a.id, label: `${a.icon} ${a.name}` }))}
              styles={inputStyle}
            />
            <Select
              label={
                <FieldLabel
                  label="执行模式"
                  tooltip="新建会话：每次创建全新会话，上下文从零开始。&#10;复用会话：在上次会话中追加消息，保留历史上下文。"
                />
              }
              value={executionMode}
              onChange={v => setExecutionMode((v as any) || 'new_conversation')}
              data={[
                { value: 'new_conversation', label: '每次新建会话' },
                { value: 'existing',         label: '复用上次会话' },
              ]}
              styles={inputStyle}
            />
          </Group>

          {/* 执行指令 */}
          <Textarea
            label={
              <FieldLabel
                label="执行指令 *"
                tooltip="触发定时任务时，将此 Prompt 发送给 AI 助手。建议写明具体目标、输出格式和边界条件。"
              />
            }
            placeholder="输入您的自动化任务指令，例如：请总结今天工作区中所有变更的代码文件..."
            value={prompt}
            onChange={e => setPrompt(e.currentTarget.value)}
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

          {/* 调度频率：卡片单选组 */}
          <Stack gap={8}>
            <FieldLabel
              label="调度频率"
              tooltip="决定此任务何时自动触发。手动触发仅在您主动点击「立即执行」时运行，不占用调度资源。"
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {SCHEDULE_OPTIONS.map(opt => {
                const active = schedulePreset === opt.value;
                return (
                  <UnstyledButton
                    key={opt.value}
                    onClick={() => setSchedulePreset(opt.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${active ? 'var(--flock-accent)' : 'var(--flock-border-dim)'}`,
                      background: active ? 'rgba(21, 90, 239, 0.08)' : 'var(--flock-bg-surface)',
                      transition: 'all 0.18s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <Group gap={6} wrap="nowrap" mb={3}>
                      <Box style={{ color: active ? 'var(--flock-accent)' : 'var(--flock-text-dim)' }}>
                        {opt.icon}
                      </Box>
                      <Text size="xs" fw={active ? 700 : 500} style={{ color: active ? 'var(--flock-text-bright)' : 'var(--flock-text-muted)' }}>
                        {opt.label}
                      </Text>
                      {opt.badge && (
                        <Badge size="xs" variant="light" color={active ? 'blue' : 'gray'} radius="sm" style={{ marginLeft: 'auto', fontSize: 9 }}>
                          {opt.badge}
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10, lineHeight: 1.3 }}>
                      {opt.desc}
                    </Text>
                  </UnstyledButton>
                );
              })}
            </div>
          </Stack>

          {/* 附加配置：根据所选频率显示 */}
          {(schedulePreset === 'daily' || schedulePreset === 'weekdays') && (
            <TextInput
              label={
                <FieldLabel
                  label={schedulePreset === 'daily' ? '每天执行时间' : '工作日执行时间'}
                  tooltip="24 小时制，格式 HH:MM，如 09:30 代表早上 9:30。"
                />
              }
              placeholder="09:00"
              value={dailyTime}
              onChange={e => setDailyTime(e.currentTarget.value)}
              styles={inputStyle}
            />
          )}

          {schedulePreset === 'weekly' && (
            <Group grow align="flex-start">
              <Select
                label={<FieldLabel label="执行星期" tooltip="每周在这一天触发任务。" />}
                value={weeklyDay}
                onChange={v => setWeeklyDay(v || '1')}
                data={WEEKDAY_OPTIONS}
                styles={inputStyle}
              />
              <TextInput
                label={<FieldLabel label="执行时间" tooltip="24 小时制，如 09:00。" />}
                placeholder="09:00"
                value={weeklyTime}
                onChange={e => setWeeklyTime(e.currentTarget.value)}
                styles={inputStyle}
              />
            </Group>
          )}

          {schedulePreset === 'custom' && (
            <TextInput
              label={
                <FieldLabel
                  label="Cron 表达式"
                  tooltip="标准 5 字段格式：分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-6,0=日)&#10;示例：*/30 * * * * = 每30分钟；0 9 * * 1-5 = 工作日9点"
                />
              }
              placeholder="0 9 * * *"
              value={customCron}
              onChange={e => setCustomCron(e.currentTarget.value)}
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
        <Button variant="subtle" onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button
          color="blue"
          loading={loading}
          disabled={!name.trim() || !prompt.trim() || !workspaceId}
          leftSection={isEditing ? <IconCheck size={16} /> : <IconPlus size={16} />}
          onClick={handleSubmit}
          style={{ background: 'var(--flock-accent)' }}
        >
          {isEditing ? '保存修改' : '创建任务'}
        </Button>
      </Group>
    </Modal>
  );
}
