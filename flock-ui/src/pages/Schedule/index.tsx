import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  SimpleGrid,
  Switch,
  ActionIcon,
  Stack,
  Tooltip,
  LoadingOverlay,
  Menu,
  Avatar,
  Badge,
  ThemeIcon,
} from '@mantine/core';
import {
  IconCalendarTime,
  IconPlus,
  IconPlayerPlay,
  IconEdit,
  IconTrash,
  IconFolder,
  IconRobot,
  IconClock,
  IconDotsVertical,
  IconAlertCircle,
  IconClick,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { CreateTaskModal } from './CreateTaskModal';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import type { CronJob } from './types';

interface Assistant {
  id: string;
  name: string;
  icon: string;
}

export function SchedulePage() {
  const { data: workspaces = [] } = useWorkspacesQuery();

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, assistantsData] = await Promise.all([
        invoke<CronJob[]>('list_cron_jobs'),
        invoke<Assistant[]>('list_assistants'),
      ]);
      setJobs(jobsData);
      setAssistants(assistantsData);
    } catch (e) {
      notifications.show({ title: '加载失败', message: String(e), color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleEnabled = async (jobId: string, current: boolean) => {
    try {
      await invoke('set_cron_job_enabled', { id: jobId, enabled: !current });
      notifications.show({
        title: !current ? '任务已启用' : '任务已禁用',
        message: !current ? '调度器将自动运行此任务' : '此任务已暂停',
        color: !current ? 'teal' : 'gray',
        autoClose: 2500,
      });
      fetchData();
    } catch (e: any) {
      notifications.show({ title: '切换失败', message: String(e), color: 'red' });
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm('确定删除此定时任务？此操作不可撤销。')) return;
    try {
      await invoke('delete_cron_job', { id: jobId });
      notifications.show({ title: '已删除', message: '定时任务已移除', color: 'teal' });
      fetchData();
    } catch (e: any) {
      notifications.show({ title: '删除失败', message: String(e), color: 'red' });
    }
  };

  const handleRunNow = async (job: CronJob) => {
    try {
      await invoke('run_cron_job_now', { id: job.id });
      notifications.show({
        title: '已触发执行',
        message: '任务已在后台启动，可在侧边栏查看进度。',
        color: 'blue',
        autoClose: 5000,
      });
      setTimeout(fetchData, 1500);
    } catch (e: any) {
      notifications.show({ title: '触发失败', message: String(e), color: 'red' });
    }
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: 'var(--flock-bg-base)',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
        padding: 24,
        position: 'relative',
      }}
    >
      <LoadingOverlay visible={loading} />

      {/* 页头 */}
      <Group justify="space-between" mb="lg" pb="md" style={{ borderBottom: '1px solid var(--flock-border-subtle)' }}>
        <Group gap="sm">
          <ThemeIcon variant="light" color="blue" size="lg" radius="md">
            <IconCalendarTime size={20} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
              定时自动化
            </Text>
            <Text size="xs" c="dimmed">
              让 AI 助手在后台按计划静默执行您的周期性任务
            </Text>
          </Stack>
        </Group>
        <Button
          size="sm"
          leftSection={<IconPlus size={15} />}
          onClick={() => { setEditingJob(null); setModalOpened(true); }}
          style={{ background: 'var(--flock-accent)' }}
        >
          新建任务
        </Button>
      </Group>

      {/* 内容区 */}
      <Box style={{ flex: 1, overflowY: 'auto' }}>
        {jobs.length === 0 && !loading ? (
          <Box
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center',
              maxWidth: 440, margin: '48px auto 0',
              padding: '48px 32px',
              borderRadius: 14,
              border: '1px dashed var(--flock-border-dim)',
              background: 'var(--flock-bg-surface)',
            }}
          >
            <ThemeIcon variant="light" color="gray" size={56} radius="xl" mb="md">
              <IconCalendarTime size={28} />
            </ThemeIcon>
            <Text size="sm" fw={600} mb={6} style={{ color: 'var(--flock-text-bright)' }}>
              暂无定时任务
            </Text>
            <Text size="xs" c="dimmed" mb="lg" style={{ maxWidth: 280 }}>
              创建一个定时任务，例如"每天早上 9 点总结昨日工作区代码变更"
            </Text>
            <Button
              size="xs"
              leftSection={<IconPlus size={13} />}
              onClick={() => { setEditingJob(null); setModalOpened(true); }}
              style={{ background: 'var(--flock-accent)' }}
            >
              立即创建
            </Button>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            {jobs.map(job => {
              const wsName = workspaces.find(w => w.id === job.workspace_id)?.name || job.workspace_id;
              const matchedA = assistants.find(a => a.id === job.assistant_id);
              const aName = job.assistant_id === '__xiaof__' ? '默认助手 (小F)' : (matchedA?.name || job.assistant_id);
              const aIcon = matchedA?.icon || '🤖';
              const isRunning = job.enabled && job.last_status !== 'error';

              return (
                <Box
                  key={job.id}
                  p="md"
                  style={{
                    borderRadius: 14,
                    border: '1px solid var(--flock-border-subtle)',
                    background: 'var(--flock-bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                  className="hover-card-lift"
                >
                  {/* 卡片头：图标 + 名称 + 菜单（与 AssistantCard 结构一致） */}
                  <Group gap="sm" wrap="nowrap" justify="space-between">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Avatar
                        size={40}
                        radius="xl"
                        style={{
                          background: job.enabled ? 'var(--flock-accent)' : 'var(--flock-bg-hover)',
                          fontSize: 18,
                          flexShrink: 0,
                          boxShadow: job.enabled ? '0 2px 6px rgba(21, 90, 239, 0.2)' : 'none',
                        }}
                      >
                        <IconCalendarTime size={20} color={job.enabled ? '#fff' : 'var(--flock-text-dim)'} />
                      </Avatar>
                      <Box style={{ minWidth: 0 }}>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" fw={700} truncate style={{ color: 'var(--flock-text-bright)' }}>
                            {job.name}
                          </Text>
                          {/* 呼吸灯 */}
                          <Box
                            style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: job.enabled ? (isRunning ? '#0ca678' : '#fa5252') : '#52525b',
                              boxShadow: job.enabled && isRunning ? '0 0 6px rgba(12,166,120,0.6)' : 'none',
                              animation: job.enabled && isRunning ? 'pulse 2.4s infinite' : 'none',
                            }}
                          />
                        </Group>
                        <Text size="xs" c="dimmed" truncate>
                          {job.schedule_desc}
                        </Text>
                      </Box>
                    </Group>

                    <Group gap={4} style={{ flexShrink: 0 }}>
                      <Switch
                        checked={job.enabled}
                        onChange={() => handleToggleEnabled(job.id, job.enabled)}
                        size="xs"
                        color="teal"
                        onClick={e => e.stopPropagation()}
                      />
                      <Menu shadow="md" position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon size="sm" variant="subtle" color="gray">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={() => { setEditingJob(job); setModalOpened(true); }}
                          >
                            编辑任务
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => handleDelete(job.id)}
                          >
                            删除任务
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                  {/* 描述 */}
                  <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 32 }}>
                    {job.description || '暂无描述'}
                  </Text>

                  {/* 元信息 Badges */}
                  <Group gap={6} wrap="wrap">
                    <Badge size="xs" variant="light" color="gray" radius="sm" leftSection={<IconFolder size={10} />}>
                      {wsName}
                    </Badge>
                    <Badge size="xs" variant="light" color="blue" radius="sm" leftSection={<IconRobot size={10} />}>
                      {aIcon} {aName}
                    </Badge>
                    {job.run_count > 0 && (
                      <Badge size="xs" variant="light" color="teal" radius="sm">
                        已运行 {job.run_count} 次
                      </Badge>
                    )}
                  </Group>

                  {/* Prompt 预览（极客风格等宽字体） */}
                  <Box
                    style={{
                      padding: '7px 10px',
                      background: 'var(--flock-bg-deepest)',
                      border: '1px solid var(--flock-border-subtle)',
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      size="xs"
                      style={{
                        fontFamily: 'var(--mantine-font-family-monospace)',
                        color: 'var(--flock-text-dim)',
                        lineHeight: 1.4,
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                      }}
                      lineClamp={2}
                    >
                      {job.prompt}
                    </Text>
                  </Box>

                  {/* 底部：时间信息 + 立即执行按钮 */}
                  <Group justify="space-between" align="flex-end" pt={4} style={{ borderTop: '1px solid var(--flock-border-subtle)' }}>
                    <Stack gap={2}>
                      <Group gap={4}>
                        <IconClock size={10} color="var(--flock-text-dim)" />
                        <Text style={{ fontSize: 10, color: 'var(--flock-text-dim)' }}>
                          {job.enabled && job.schedule_kind !== 'manual'
                            ? `下次 ${formatTime(job.next_run_at)}`
                            : '手动触发'}
                        </Text>
                      </Group>
                      {job.last_run_at && (
                        <Text style={{ fontSize: 10, color: 'var(--flock-text-dim)' }}>
                          上次 {formatTime(job.last_run_at)}
                        </Text>
                      )}
                      {job.last_status === 'error' && job.last_error && (
                        <Tooltip label={job.last_error} withArrow multiline w={200}>
                          <Group gap={3} style={{ cursor: 'help' }}>
                            <IconAlertCircle size={10} color="#f87171" />
                            <Text style={{ fontSize: 10, color: '#f87171' }}>执行出错</Text>
                          </Group>
                        </Tooltip>
                      )}
                    </Stack>

                    <Tooltip label="立即触发执行一次" withArrow>
                      <ActionIcon
                        onClick={() => handleRunNow(job)}
                        size="md"
                        radius="md"
                        variant="light"
                        color="blue"
                      >
                        <IconPlayerPlay size={15} fill="currentColor" />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </Box>

      <CreateTaskModal
        opened={modalOpened}
        onClose={() => { setModalOpened(false); setEditingJob(null); }}
        onSuccess={fetchData}
        jobToEdit={editingJob}
      />

      <style>{`
        @keyframes pulse {
          0%   { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(12,166,120,0.6); }
          70%  { transform: scale(1);   box-shadow: 0 0 0 5px rgba(12,166,120,0); }
          100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(12,166,120,0); }
        }
      `}</style>
    </Box>
  );
}

export default SchedulePage;
