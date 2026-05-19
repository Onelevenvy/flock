import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  SegmentedControl,
  Button,
  Group,
  Stack,
  Text,
  NumberInput,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import { notifications } from '@mantine/notifications';
import { IconCalendarTime, IconPlus, IconDeviceFloppy } from '@tabler/icons-react';
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

export function CreateTaskModal({ opened, onClose, onSuccess, jobToEdit }: CreateTaskModalProps) {
  const { t } = useTranslation();
  const { data: workspaces = [] } = useWorkspacesQuery();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'new_conversation' | 'existing'>('new_conversation');
  const [prompt, setPrompt] = useState('');
  const [scheduleType, setScheduleType] = useState<'manual' | 'every' | 'daily' | 'cron'>('manual');
  
  // 额外配置项
  const [intervalMins, setIntervalMins] = useState<number>(30);
  const [dailyTime, setDailyTime] = useState('09:00');
  const [cronExpr, setCronExpr] = useState('0 9 * * *');

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载助手列表
  useEffect(() => {
    invoke<Assistant[]>('list_assistants')
      .then((data) => {
        // 添加一个默认小 F 助手占位，如果系统里没有
        const list = [...data];
        if (!list.some(a => a.id === 'xiaof')) {
          list.unshift({
            id: '__xiaof__',
            name: '默认助手 (小F)',
            icon: '🤖',
            description: '通用极智 AI 助理',
          });
        }
        setAssistants(list);
        if (list.length > 0 && !assistantId) {
          setAssistantId(list[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // 挂载编辑数据
  useEffect(() => {
    if (opened) {
      if (jobToEdit) {
        setName(jobToEdit.name);
        setDescription(jobToEdit.description);
        setWorkspaceId(jobToEdit.workspace_id);
        setAssistantId(jobToEdit.assistant_id);
        setExecutionMode(jobToEdit.execution_mode);
        setPrompt(jobToEdit.prompt);

        if (jobToEdit.schedule_kind === 'manual') {
          setScheduleType('manual');
        } else if (jobToEdit.schedule_kind === 'every') {
          setScheduleType('every');
          setIntervalMins(parseInt(jobToEdit.schedule_value, 10) || 30);
        } else if (jobToEdit.schedule_kind === 'cron') {
          // 判断是否是“每天定时”格式，如 "30 9 * * *"
          const parts = jobToEdit.schedule_value.split(' ');
          if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
            setScheduleType('daily');
            const hh = parts[1].padStart(2, '0');
            const mm = parts[0].padStart(2, '0');
            setDailyTime(`${hh}:${mm}`);
          } else {
            setScheduleType('cron');
            setCronExpr(jobToEdit.schedule_value);
          }
        }
      } else {
        // 重置为默认值
        setName('');
        setDescription('');
        setWorkspaceId(workspaces.length > 0 ? workspaces[0].id : null);
        setAssistantId(assistants.length > 0 ? assistants[0].id : null);
        setExecutionMode('new_conversation');
        setPrompt('');
        setScheduleType('manual');
        setIntervalMins(30);
        setDailyTime('09:00');
        setCronExpr('0 9 * * *');
      }
    }
  }, [opened, jobToEdit, workspaces, assistants]);

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

    setLoading(true);

    // 组装调度配置
    let schedule_kind: 'manual' | 'every' | 'cron' = 'manual';
    let schedule_value = '';
    let schedule_desc = '手动触发';

    if (scheduleType === 'every') {
      schedule_kind = 'every';
      schedule_value = String(intervalMins);
      schedule_desc = `每隔 ${intervalMins} 分钟`;
    } else if (scheduleType === 'daily') {
      schedule_kind = 'cron';
      const [hh, mm] = dailyTime.split(':');
      // 解析成 Cron 格式: mm hh * * *
      const h_val = parseInt(hh, 10);
      const m_val = parseInt(mm, 10);
      schedule_value = `${m_val} ${h_val} * * *`;
      schedule_desc = `每天定时 ${dailyTime}`;
    } else if (scheduleType === 'cron') {
      schedule_kind = 'cron';
      schedule_value = cronExpr.trim();
      schedule_desc = `Cron 表达式: ${cronExpr}`;
    }

    const payload = {
      id: jobToEdit ? jobToEdit.id : null,
      name: name.trim(),
      description: description.trim(),
      enabled: jobToEdit ? jobToEdit.enabled : true,
      schedule_kind,
      schedule_value,
      schedule_desc,
      execution_mode: executionMode,
      prompt: prompt.trim(),
      workspace_id: workspaceId,
      assistant_id: assistantId,
    };

    try {
      if (jobToEdit) {
        await invoke('update_cron_job', { id: jobToEdit.id, input: payload });
        notifications.show({ title: '成功', message: '定时自动化任务已更新', color: 'teal' });
      } else {
        await invoke('create_cron_job', { input: payload });
        notifications.show({ title: '成功', message: '已成功创建定时自动化任务', color: 'teal' });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      notifications.show({ title: '操作失败', message: String(e), color: 'red', autoClose: 6000 });
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
          <IconCalendarTime size={20} color="var(--flock-accent)" />
          <Text fw={700} size="md" style={{ color: 'var(--flock-text-bright)' }}>
            {jobToEdit ? '编辑自动化定时任务' : '创建自动化定时任务'}
          </Text>
        </Group>
      }
      size="md"
      radius="lg"
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
          paddingBottom: 12,
        },
      }}
    >
      <Stack gap="md" pt="xs">
        {/* 第一步：选择工作空间（加星必填且置于最前） */}
        <Select
          label={<Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>1. 选择工作空间 <span style={{ color: 'red' }}>*</span></Text>}
          description="定时任务执行时关联的物理工作区"
          placeholder="请选择工作空间"
          value={workspaceId}
          onChange={setWorkspaceId}
          data={workspaces.map(w => ({ value: w.id, label: w.name }))}
          required
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              '&:focus': {
                borderColor: 'var(--flock-border-base)',
              }
            }
          }}
        />

        <TextInput
          label={<Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>任务名称 <span style={{ color: 'red' }}>*</span></Text>}
          placeholder="例如：生成每日代码变更周报"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
            }
          }}
        />

        <TextInput
          label="任务描述"
          placeholder="简要说明此定时任务的自动化意图"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
            }
          }}
        />

        <Group grow gap="md">
          <Select
            label={<Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>执行助手 <span style={{ color: 'red' }}>*</span></Text>}
            value={assistantId}
            onChange={setAssistantId}
            data={assistants.map(a => ({ value: a.id, label: `${a.icon} ${a.name}` }))}
            required
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              }
            }}
          />

          <Stack gap={3}>
            <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)' }}>执行模式</Text>
            <SegmentedControl
              value={executionMode}
              onChange={(val) => setExecutionMode(val as any)}
              data={[
                { value: 'new_conversation', label: '新建会话' },
                { value: 'existing', label: '持续会话' },
              ]}
              size="xs"
              styles={{
                root: {
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  padding: 3,
                },
                control: {
                  border: 'none',
                }
              }}
            />
          </Stack>
        </Group>

        <Textarea
          label={<Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>执行指令 <span style={{ color: 'red' }}>*</span></Text>}
          description="触发任务时，发送给 AI 助手的 Prompt 内容"
          placeholder="请在此处输入您的完整自动化指令..."
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          minRows={4}
          required
          styles={{
            input: {
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontSize: 12,
            }
          }}
        />

        <Stack gap={4}>
          <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }}>调度频率</Text>
          <SegmentedControl
            value={scheduleType}
            onChange={(val) => setScheduleType(val as any)}
            data={[
              { value: 'manual', label: '手动触发' },
              { value: 'every', label: '固定间隔' },
              { value: 'daily', label: '每天定时' },
              { value: 'cron', label: 'Cron表达式' },
            ]}
            size="xs"
            styles={{
              root: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                padding: 3,
              }
            }}
          />
        </Stack>

        {/* 动态显示不同频率的配置项 */}
        {scheduleType === 'every' && (
          <NumberInput
            label="时间间隔 (分钟)"
            description="任务每隔多少分钟执行一次"
            value={intervalMins}
            onChange={(val) => setIntervalMins(Number(val) || 30)}
            min={1}
            max={1440}
            required
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              }
            }}
          />
        )}

        {scheduleType === 'daily' && (
          <TextInput
            label="每天定时执行时间"
            description="例如 09:30 或 18:00 (24小时制)"
            placeholder="09:00"
            value={dailyTime}
            onChange={(e) => setDailyTime(e.currentTarget.value)}
            required
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              }
            }}
          />
        )}

        {scheduleType === 'cron' && (
          <TextInput
            label="Cron 表达式"
            description="标准 5 字段 Cron：分 时 日 月 周 (例如 '*/30 * * * *')"
            placeholder="0 9 * * *"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.currentTarget.value)}
            required
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                fontFamily: 'var(--mantine-font-family-monospace)',
              }
            }}
          />
        )}

        <Group justify="flex-end" mt="md" pt="sm" style={{ borderTop: '1px solid var(--flock-border-subtle)' }}>
          <Button variant="subtle" color="gray" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!name.trim() || !prompt.trim() || !workspaceId}
            leftSection={jobToEdit ? <IconDeviceFloppy size={16} /> : <IconPlus size={16} />}
            style={{
              background: 'var(--flock-accent)',
              boxShadow: '0 2px 8px rgba(21, 90, 239, 0.25)',
              transition: 'all 0.2s',
            }}
            className="hover-card-lift"
          >
            {jobToEdit ? '保存修改' : '创建任务'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
