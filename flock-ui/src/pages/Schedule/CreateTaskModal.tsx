import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Text,
  NumberInput,
  Divider,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { IconCalendarTime, IconPlus, IconDeviceFloppy } from '@tabler/icons-react';
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

// 调度频率预设选项
const SCHEDULE_PRESETS = [
  { value: 'manual',   label: '手动触发' },
  { value: 'hourly',   label: '每小时' },
  { value: 'daily',    label: '每天定时' },
  { value: 'weekdays', label: '工作日 (周一~周五)' },
  { value: 'weekly',   label: '每周' },
  { value: 'custom',   label: '自定义 Cron 表达式' },
];

const WEEKDAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' },
];

const inputStyle = {
  input: {
    background: 'var(--flock-bg-surface)',
    border: '1px solid var(--flock-border-dim)',
    color: 'var(--flock-text-bright)',
    '&:focus': { borderColor: 'var(--flock-accent)' },
  },
};

export function CreateTaskModal({ opened, onClose, onSuccess, jobToEdit }: CreateTaskModalProps) {
  const { data: workspaces = [] } = useWorkspacesQuery();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'new_conversation' | 'existing'>('new_conversation');
  const [prompt, setPrompt] = useState('');

  // 调度频率
  const [schedulePreset, setSchedulePreset] = useState<string>('manual');
  const [dailyTime, setDailyTime] = useState('09:00');
  const [weeklyDay, setWeeklyDay] = useState('1'); // 1=周一
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
      } else if (schedule_kind === 'every') {
        // every 格式不在新版本中，兼容旧数据: 每小时=60
        setSchedulePreset('hourly');
      } else if (schedule_kind === 'cron') {
        const parts = schedule_value.split(' ');
        if (parts.length === 5) {
          const [m, h, d, mo, wd] = parts;
          // 每小时: "0 * * * *"
          if (h === '*' && d === '*' && mo === '*' && wd === '*') {
            setSchedulePreset('hourly');
          // 工作日: "0 9 * * 1-5"
          } else if (wd === '1-5' && d === '*' && mo === '*') {
            setSchedulePreset('weekdays');
            setDailyTime(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
          // 每周: "0 9 * * 1"  单数字星期
          } else if (/^\d$/.test(wd) && d === '*' && mo === '*') {
            setSchedulePreset('weekly');
            setWeeklyDay(wd);
            setWeeklyTime(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
          // 每天: "0 9 * * *"
          } else if (wd === '*' && d === '*' && mo === '*') {
            setSchedulePreset('daily');
            setDailyTime(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
          } else {
            setSchedulePreset('custom');
            setCustomCron(schedule_value);
          }
        } else {
          setSchedulePreset('custom');
          setCustomCron(schedule_value);
        }
      }
    } else {
      // 重置
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

  // 初始化默认工作区
  useEffect(() => {
    if (!jobToEdit && workspaces.length > 0 && !workspaceId) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces]);

  // 初始化默认助手
  useEffect(() => {
    if (!jobToEdit && assistants.length > 0 && !assistantId) {
      setAssistantId(assistants[0].id);
    }
  }, [assistants]);

  /** 根据预设生成 schedule_kind / schedule_value / schedule_desc */
  const buildSchedule = () => {
    switch (schedulePreset) {
      case 'manual':
        return { kind: 'manual', value: '', desc: '手动触发' };
      case 'hourly':
        return { kind: 'cron', value: '0 * * * *', desc: '每小时整点' };
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
      case 'custom':
        return { kind: 'cron', value: customCron.trim(), desc: `Cron: ${customCron.trim()}` };
      default:
        return { kind: 'manual', value: '', desc: '手动触发' };
    }
  };

  const handleSubmit = async () => {
    if (!workspaceId) {
      notifications.show({ title: '提交失败', message: '请在第一步选择工作空间', color: 'red' });
      return;
    }
    if (!name.trim()) {
      notifications.show({ title: '提交失败', message: '请输入任务名称', color: 'red' });
      return;
    }
    if (!assistantId) {
      notifications.show({ title: '提交失败', message: '请选择执行助手', color: 'red' });
      return;
    }
    if (!prompt.trim()) {
      notifications.show({ title: '提交失败', message: '请输入执行指令', color: 'red' });
      return;
    }
    if (schedulePreset === 'custom' && !customCron.trim()) {
      notifications.show({ title: '提交失败', message: '请填写自定义 Cron 表达式', color: 'red' });
      return;
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
      assistant_id: assistantId,
    };

    try {
      if (jobToEdit) {
        await invoke('update_cron_job', { id: jobToEdit.id, input: payload });
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

  const labelStyle = { size: 'sm' as const, fw: 500, style: { color: 'var(--flock-text-muted)' } };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCalendarTime size={18} color="var(--flock-accent)" />
          <Text fw={700} size="sm" style={{ color: 'var(--flock-text-bright)' }}>
            {jobToEdit ? '编辑定时自动化任务' : '创建定时自动化任务'}
          </Text>
        </Group>
      }
      size="md"
      radius="lg"
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
        },
        body: { padding: '16px 20px 20px' },
      }}
    >
      <Stack gap="sm">
        {/* Step 1: 工作空间 */}
        <Select
          label={<Text {...labelStyle}>1. 工作空间 <span style={{ color: '#f87171' }}>*</span></Text>}
          placeholder="选择关联工作区..."
          value={workspaceId}
          onChange={setWorkspaceId}
          data={workspaces.map(w => ({ value: w.id, label: w.name }))}
          styles={inputStyle}
        />

        {/* 任务名称 + 描述 */}
        <TextInput
          label={<Text {...labelStyle}>任务名称 <span style={{ color: '#f87171' }}>*</span></Text>}
          placeholder="例如：每日代码变更周报"
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          styles={inputStyle}
        />

        <TextInput
          label={<Text {...labelStyle}>任务描述</Text>}
          placeholder="可选：简要说明此任务的目的"
          value={description}
          onChange={e => setDescription(e.currentTarget.value)}
          styles={inputStyle}
        />

        {/* 执行助手 + 执行模式 */}
        <Group grow align="flex-start">
          <Select
            label={<Text {...labelStyle}>执行助手 <span style={{ color: '#f87171' }}>*</span></Text>}
            value={assistantId}
            onChange={setAssistantId}
            data={assistants.map(a => ({ value: a.id, label: `${a.icon} ${a.name}` }))}
            styles={inputStyle}
          />
          <Select
            label={<Text {...labelStyle}>执行模式</Text>}
            value={executionMode}
            onChange={v => setExecutionMode((v as any) || 'new_conversation')}
            data={[
              { value: 'new_conversation', label: '每次新建会话' },
              { value: 'existing', label: '复用上次会话' },
            ]}
            styles={inputStyle}
          />
        </Group>

        {/* 执行指令 */}
        <Textarea
          label={<Text {...labelStyle}>执行指令 <span style={{ color: '#f87171' }}>*</span></Text>}
          description="触发时发送给 AI 助手的完整 Prompt"
          placeholder="输入您的自动化任务指令..."
          value={prompt}
          onChange={e => setPrompt(e.currentTarget.value)}
          minRows={4}
          autosize
          styles={{
            input: {
              ...inputStyle.input,
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontSize: 12,
            },
          }}
        />

        <Divider style={{ borderColor: 'var(--flock-border-subtle)' }} />

        {/* 调度频率：下拉选择 */}
        <Select
          label={<Text {...labelStyle}>调度频率</Text>}
          value={schedulePreset}
          onChange={v => setSchedulePreset(v || 'manual')}
          data={SCHEDULE_PRESETS}
          styles={inputStyle}
        />

        {/* 根据所选频率展示附加设置 */}
        {schedulePreset === 'daily' && (
          <TextInput
            label={<Text {...labelStyle}>执行时间 (每天)</Text>}
            description="24 小时制，如 09:30"
            placeholder="09:00"
            value={dailyTime}
            onChange={e => setDailyTime(e.currentTarget.value)}
            styles={inputStyle}
          />
        )}

        {schedulePreset === 'weekdays' && (
          <TextInput
            label={<Text {...labelStyle}>执行时间 (工作日)</Text>}
            description="周一至周五，每天此时间执行"
            placeholder="09:00"
            value={dailyTime}
            onChange={e => setDailyTime(e.currentTarget.value)}
            styles={inputStyle}
          />
        )}

        {schedulePreset === 'weekly' && (
          <Group grow align="flex-start">
            <Select
              label={<Text {...labelStyle}>执行星期</Text>}
              value={weeklyDay}
              onChange={v => setWeeklyDay(v || '1')}
              data={WEEKDAY_OPTIONS}
              styles={inputStyle}
            />
            <TextInput
              label={<Text {...labelStyle}>执行时间</Text>}
              placeholder="09:00"
              value={weeklyTime}
              onChange={e => setWeeklyTime(e.currentTarget.value)}
              styles={inputStyle}
            />
          </Group>
        )}

        {schedulePreset === 'custom' && (
          <TextInput
            label={<Text {...labelStyle}>Cron 表达式</Text>}
            description="标准 5 字段：分 时 日 月 周，如 '*/30 * * * *'"
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

        {/* 底部操作 */}
        <Group justify="flex-end" mt={4}>
          <Button variant="subtle" color="gray" onClick={onClose} disabled={loading} size="sm">
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={loading}
            disabled={!name.trim() || !prompt.trim() || !workspaceId}
            leftSection={jobToEdit ? <IconDeviceFloppy size={15} /> : <IconPlus size={15} />}
            style={{
              background: 'var(--flock-accent)',
              boxShadow: '0 2px 8px rgba(21, 90, 239, 0.25)',
            }}
          >
            {jobToEdit ? '保存修改' : '创建任务'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
