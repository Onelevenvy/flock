import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { useWorkspacesQuery } from './useWorkspaces';
import { useAssistantsQuery } from './useAssistants';
import { useCreateCronJobMutation, useUpdateCronJobMutation } from './useCronJobs';
import type { CronJob } from '../pages/Schedule/types';
import type { Assistant } from '../types/assistant';

// ==================== Cron Form Data Types ====================

export type SchedulePreset = 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'custom';

export const WEEKDAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' },
];


// ==================== buildSchedule helper ====================

export function buildSchedule(
  preset: SchedulePreset,
  dailyTime: string,
  weeklyDay: string,
  weeklyTime: string,
  customCron: string,
) {
  switch (preset) {
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
}

/** 从现有 CronJob 反推出 SchedulePreset 和子配置 */
export function parseSchedule(job: CronJob) {
  const { schedule_kind, schedule_value } = job;
  if (schedule_kind === 'manual') return { preset: 'manual' as SchedulePreset, dailyTime: '09:00', weeklyDay: '1', weeklyTime: '09:00', customCron: '0 9 * * *' };
  if (schedule_kind !== 'cron') return { preset: 'custom' as SchedulePreset, dailyTime: '09:00', weeklyDay: '1', weeklyTime: '09:00', customCron: schedule_value };

  const parts = schedule_value.split(' ');
  if (parts.length === 5) {
    const [m, h, , , wd] = parts;
    if (h === '*') return { preset: 'hourly' as SchedulePreset, dailyTime: '09:00', weeklyDay: '1', weeklyTime: '09:00', customCron: '0 9 * * *' };
    const time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    if (wd === '1-5') return { preset: 'weekdays' as SchedulePreset, dailyTime: time, weeklyDay: '1', weeklyTime: '09:00', customCron: '0 9 * * *' };
    if (/^\d$/.test(wd)) return { preset: 'weekly' as SchedulePreset, dailyTime: '09:00', weeklyDay: wd, weeklyTime: time, customCron: '0 9 * * *' };
    if (wd === '*') return { preset: 'daily' as SchedulePreset, dailyTime: time, weeklyDay: '1', weeklyTime: '09:00', customCron: '0 9 * * *' };
  }
  return { preset: 'custom' as SchedulePreset, dailyTime: '09:00', weeklyDay: '1', weeklyTime: '09:00', customCron: schedule_value };
}

// ==================== useCronForm Hook ====================

interface UseCronFormOptions {
  opened: boolean;
  jobToEdit: CronJob | null | undefined;
  onSuccess: () => void;
  onClose: () => void;
}

export function useCronForm({ opened, jobToEdit, onSuccess, onClose }: UseCronFormOptions) {
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { data: rawAssistants = [] } = useAssistantsQuery();
  const createMutation = useCreateCronJobMutation();
  const updateMutation = useUpdateCronJobMutation();

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'new_conversation' | 'existing'>('new_conversation');
  const [prompt, setPrompt] = useState('');

  // Schedule fields
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('manual');
  const [dailyTime, setDailyTime] = useState('09:00');
  const [weeklyDay, setWeeklyDay] = useState('1');
  const [weeklyTime, setWeeklyTime] = useState('09:00');
  const [customCron, setCustomCron] = useState('0 9 * * *');

  // Assistants list (prepend default if missing)
  const assistants: Assistant[] = rawAssistants.some(a => a.id === '__xiaof__')
    ? rawAssistants
    : [{ id: '__xiaof__', name: '默认助手 (小F)', icon: '🤖', description: '', is_builtin: true, model: '', system_prompt: '', tools: [], skills: [], sort_order: -1 } as Assistant, ...rawAssistants];
  const loading = createMutation.isPending || updateMutation.isPending;

  // Init/reset on open
  useEffect(() => {
    if (!opened) return;
    if (jobToEdit) {
      setName(jobToEdit.name);
      setDescription(jobToEdit.description);
      setWorkspaceId(jobToEdit.workspace_id);
      setAssistantId(jobToEdit.assistant_id);
      setExecutionMode(jobToEdit.execution_mode as any);
      setPrompt(jobToEdit.prompt);
      const parsed = parseSchedule(jobToEdit);
      setSchedulePreset(parsed.preset);
      setDailyTime(parsed.dailyTime);
      setWeeklyDay(parsed.weeklyDay);
      setWeeklyTime(parsed.weeklyTime);
      setCustomCron(parsed.customCron);
    } else {
      setName('');
      setDescription('');
      setWorkspaceId(workspaces[0]?.id ?? null);
      setAssistantId(assistants[0]?.id ?? null);
      setExecutionMode('new_conversation');
      setPrompt('');
      setSchedulePreset('manual');
      setDailyTime('09:00');
      setWeeklyDay('1');
      setWeeklyTime('09:00');
      setCustomCron('0 9 * * *');
    }
  }, [opened, jobToEdit]);

  // Auto-set defaults when lists load
  useEffect(() => {
    if (!jobToEdit && workspaces.length > 0 && !workspaceId) setWorkspaceId(workspaces[0].id);
  }, [workspaces]);

  useEffect(() => {
    if (!jobToEdit && assistants.length > 0 && !assistantId) setAssistantId(assistants[0].id);
  }, [assistants]);

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

    const { kind, value, desc } = buildSchedule(schedulePreset, dailyTime, weeklyDay, weeklyTime, customCron);
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
      if (jobToEdit) {
        await updateMutation.mutateAsync({ id: jobToEdit.id, input: payload });
        notifications.show({ title: '已更新', message: '定时任务配置已保存', color: 'teal' });
      } else {
        await createMutation.mutateAsync(payload);
        notifications.show({ title: '已创建', message: '定时任务已成功建立', color: 'teal' });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      notifications.show({ title: '操作失败', message: String(e), color: 'red', autoClose: 8000 });
    }
  };

  return {
    // data
    workspaces,
    assistants,
    loading,
    // fields
    name, setName,
    description, setDescription,
    workspaceId, setWorkspaceId,
    assistantId, setAssistantId,
    executionMode, setExecutionMode,
    prompt, setPrompt,
    // schedule
    schedulePreset, setSchedulePreset,
    dailyTime, setDailyTime,
    weeklyDay, setWeeklyDay,
    weeklyTime, setWeeklyTime,
    customCron, setCustomCron,
    // actions
    handleSubmit,
  };
}
