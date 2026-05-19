import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  SimpleGrid,
  Badge,
  Switch,
  ActionIcon,
  Stack,
  Card,
  Tooltip,
  LoadingOverlay,
  Menu,
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
  IconRotate,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { CreateTaskModal } from './CreateTaskModal';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import type { CronJob } from './types';

interface Assistant {
  id: string;
  name: string;
  icon: string;
}

export function SchedulePage() {
  const { t } = useTranslation();
  const { data: workspaces = [] } = useWorkspacesQuery();

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);

  // 弹窗状态
  const [modalOpened, setModalOpened] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  // 加载数据
  const fetchJobsAndAssistants = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, assistantsData] = await Promise.all([
        invoke<CronJob[]>('list_cron_jobs'),
        invoke<Assistant[]>('list_assistants'),
      ]);
      setJobs(jobsData);
      setAssistants(assistantsData);
    } catch (e) {
      console.error('Failed to fetch schedule data:', e);
      notifications.show({ title: '加载失败', message: String(e), color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobsAndAssistants();
  }, [fetchJobsAndAssistants]);

  // 处理启用/禁用切换
  const handleToggleEnabled = async (jobId: string, currentVal: boolean) => {
    try {
      await invoke('set_cron_job_enabled', { id: jobId, enabled: !currentVal });
      notifications.show({
        title: !currentVal ? '任务已启用' : '任务已禁用',
        message: !currentVal ? '调度器将在后台自动运行此任务' : '此任务已暂停调度',
        color: !currentVal ? 'teal' : 'gray',
        autoClose: 3000,
      });
      fetchJobsAndAssistants();
    } catch (e: any) {
      notifications.show({ title: '切换失败', message: String(e), color: 'red' });
    }
  };

  // 处理删除任务
  const handleDeleteJob = async (jobId: string) => {
    if (window.confirm('您确定要删除这个定时自动化任务吗？此操作不可逆。')) {
      try {
        await invoke('delete_cron_job', { id: jobId });
        notifications.show({ title: '已删除', message: '定时任务已被彻底移除', color: 'teal' });
        fetchJobsAndAssistants();
      } catch (e: any) {
        notifications.show({ title: '删除失败', message: String(e), color: 'red' });
      }
    }
  };

  // 处理立即执行一次
  const handleRunNow = async (job: CronJob) => {
    try {
      await invoke('run_cron_job_now', { id: job.id });
      notifications.show({
        title: '已触发执行',
        message: '定时任务已在后台启动，新会话已生成。您可以在侧边栏查看执行进度。',
        color: 'blue',
        autoClose: 6000,
      });
      // 稍微等待下重新刷新状态
      setTimeout(fetchJobsAndAssistants, 1500);
    } catch (e: any) {
      notifications.show({ title: '触发失败', message: String(e), color: 'red' });
    }
  };

  // 格式化时间戳
  const formatTime = (ts: number | null) => {
    if (!ts) return '无';
    const date = new Date(ts);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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
        borderRadius: '16px',
        border: '1px solid var(--flock-border-subtle)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        padding: '24px',
        position: 'relative',
      }}
    >
      <LoadingOverlay visible={loading} />

      {/* 顶部 Header */}
      <Group justify="space-between" mb="lg" style={{ borderBottom: '1px solid var(--flock-border-subtle)', paddingBottom: 16 }}>
        <Group gap="sm">
          <Box
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--flock-accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--flock-accent)',
              boxShadow: '0 4px 12px rgba(21, 90, 239, 0.1)',
            }}
          >
            <IconCalendarTime size={24} stroke={1.5} />
          </Box>
          <Stack gap={0}>
            <Text fw={700} size="xl" style={{ color: 'var(--flock-text-bright)' }}>
              定时自动化 (Cron)
            </Text>
            <Text size="xs" c="dimmed">
              设置触发规则与提示词，让 AI 助手在后台帮您自动静默执行各种周期性任务。
            </Text>
          </Stack>
        </Group>
        <Button
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setEditingJob(null);
            setModalOpened(true);
          }}
          style={{
            background: 'var(--flock-accent)',
            boxShadow: '0 2px 8px rgba(21, 90, 239, 0.25)',
          }}
          className="hover-card-lift"
        >
          新建定时任务
        </Button>
      </Group>

      {/* 核心卡片列表 */}
      <Box style={{ flex: 1, overflowY: 'auto' }} pr="2px">
        {jobs.length === 0 && !loading ? (
          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              border: '2px dashed var(--flock-border-dim)',
              background: 'var(--flock-bg-surface)',
              textAlign: 'center',
              maxWidth: 500,
              margin: '40px auto 0',
              padding: '64px 32px',
            }}
          >
            <Box
              style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                background: 'var(--flock-bg-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--flock-text-dim)',
                marginBottom: 16,
              }}
            >
              <IconCalendarTime size={32} />
            </Box>
            <Text size="md" fw={600} style={{ color: 'var(--flock-text-bright)', marginBottom: 8 }}>
              暂无定时自动化任务
            </Text>
            <Text size="xs" c="dimmed" style={{ maxWidth: 320, marginBottom: 20 }}>
              您可以创建一个定时任务，例如“每天早上 9 点总结昨日工作区变更”或“每半小时检查代码状态”。
            </Text>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setEditingJob(null);
                setModalOpened(true);
              }}
              style={{ background: 'var(--flock-accent)' }}
            >
              立即创建
            </Button>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            {jobs.map((job) => {
              const wsName = workspaces.find((w) => w.id === job.workspace_id)?.name || job.workspace_id;
              
              const matchedAssistant = assistants.find((a) => a.id === job.assistant_id);
              const assistantName = job.assistant_id === '__xiaof__' 
                ? '默认助手 (小F)' 
                : (matchedAssistant?.name || job.assistant_id);
              const assistantIcon = matchedAssistant?.icon || '🤖';

              const isOk = job.last_status === 'ok';

              return (
                <Card
                  key={job.id}
                  p="md"
                  radius="lg"
                  withBorder
                  style={{
                    background: 'var(--flock-bg-surface)',
                    borderColor: 'var(--flock-border-dim)',
                    transition: 'all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  }}
                  className="hover-card-lift"
                >
                  <Stack gap="sm">
                    {/* 卡片头部：开关与状态 */}
                    <Group justify="space-between" align="center">
                      <Group gap={6}>
                        {/* 生命力状态灯 */}
                        {job.enabled ? (
                          isOk ? (
                            <Box
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#0ca678', // teal
                                boxShadow: '0 0 8px rgba(12, 166, 120, 0.6)',
                                animation: 'pulse 2s infinite',
                              }}
                            />
                          ) : (
                            <Box
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#fa5252', // red
                                boxShadow: '0 0 8px rgba(250, 82, 82, 0.6)',
                              }}
                            />
                          )
                        ) : (
                          <Box
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#868e96', // gray
                            }}
                          />
                        )}
                        <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)' }}>
                          {job.enabled ? (isOk ? '调度运行中' : '运行异常') : '已暂停'}
                        </Text>
                      </Group>

                      <Group gap="xs">
                        <Switch
                          checked={job.enabled}
                          onChange={() => handleToggleEnabled(job.id, job.enabled)}
                          size="xs"
                          color="teal"
                          styles={{
                            track: {
                              cursor: 'pointer',
                            }
                          }}
                        />
                        <Menu shadow="md" width={120} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" size="sm">
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown style={{ background: 'var(--flock-bg-raised)', border: '1px solid var(--flock-border-dim)' }}>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={() => {
                                setEditingJob(job);
                                setModalOpened(true);
                              }}
                            >
                              编辑任务
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconTrash size={14} color="var(--mantine-color-red-6)" />}
                              color="red"
                              onClick={() => handleDeleteJob(job.id)}
                            >
                              删除任务
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Group>

                    {/* 卡片主体：名称与描述 */}
                    <Stack gap={4}>
                      <Text fw={700} size="md" style={{ color: 'var(--flock-text-bright)' }} lineClamp={1}>
                        {job.name}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }}>
                        {job.description || '暂无任务描述'}
                      </Text>
                    </Stack>

                    {/* 配置关系组：工作区、助手、执行模式 */}
                    <Box style={{ background: 'var(--flock-bg-deepest)', padding: 10, borderRadius: 8 }}>
                      <Stack gap={6}>
                        <Group gap={6} wrap="nowrap">
                          <IconFolder size={12} color="var(--flock-text-dim)" />
                          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                            工作区: <span style={{ color: 'var(--flock-text-bright)', fontWeight: 500 }}>{wsName}</span>
                          </Text>
                        </Group>
                        <Group gap={6} wrap="nowrap">
                          <IconRobot size={12} color="var(--flock-text-dim)" />
                          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                            助手: <span style={{ color: 'var(--flock-text-bright)', fontWeight: 500 }}>{assistantIcon} {assistantName}</span>
                          </Text>
                        </Group>
                        <Group gap={6} wrap="nowrap">
                          <IconClock size={12} color="var(--flock-text-dim)" />
                          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                            频率: <span style={{ color: 'var(--flock-text-bright)', fontWeight: 500 }}>{job.schedule_desc}</span>
                          </Text>
                        </Group>
                      </Stack>
                    </Box>

                    {/* 极客 Prompt 预览 */}
                    <Box
                      style={{
                        padding: 8,
                        background: 'rgba(0,0,0,0.1)',
                        border: '1px solid var(--flock-border-subtle)',
                        borderRadius: 6,
                        maxHeight: 64,
                        overflow: 'hidden',
                      }}
                    >
                      <Text
                        size="xs"
                        style={{
                          fontFamily: 'var(--mantine-font-family-monospace)',
                          whiteSpace: 'pre-wrap',
                          color: '#a1a1aa',
                          lineHeight: 1.3,
                        }}
                        lineClamp={3}
                      >
                        {job.prompt}
                      </Text>
                    </Box>

                    {/* 底部信息：时间参数及一键立即运行 */}
                    <Group justify="space-between" align="flex-end" pt="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)' }}>
                      <Stack gap={2}>
                        <Text size="xxs" style={{ color: 'var(--flock-text-dim)', fontSize: 10 }}>
                          下次运行: {job.enabled && job.schedule_kind !== 'manual' ? formatTime(job.next_run_at) : '无'}
                        </Text>
                        <Text size="xxs" style={{ color: 'var(--flock-text-dim)', fontSize: 10 }}>
                          上次运行: {formatTime(job.last_run_at)} {job.run_count > 0 && `(第 ${job.run_count} 次)`}
                        </Text>
                        {!isOk && job.last_error && (
                          <Tooltip label={job.last_error} withArrow>
                            <Group gap={4} style={{ cursor: 'pointer' }}>
                              <IconAlertCircle size={10} color="#fa5252" />
                              <Text size="xxs" color="red" fw={500} style={{ fontSize: 10 }}>查看错误</Text>
                            </Group>
                          </Tooltip>
                        )}
                      </Stack>

                      <Tooltip label="立即静默触发执行一次" withArrow>
                        <ActionIcon
                          onClick={() => handleRunNow(job)}
                          size="md"
                          radius="md"
                          style={{
                            background: 'var(--flock-accent-soft)',
                            color: 'var(--flock-accent)',
                          }}
                          className="hover-card-lift"
                        >
                          <IconPlayerPlay size={16} fill="currentColor" />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Box>

      {/* 创建与编辑 Modal */}
      <CreateTaskModal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingJob(null);
        }}
        onSuccess={fetchJobsAndAssistants}
        jobToEdit={editingJob}
      />

      {/* 注入呼吸灯 CSS 动画 */}
      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(12, 166, 120, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(12, 166, 120, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(12, 166, 120, 0);
          }
        }
      `}</style>
    </Box>
  );
}
export default SchedulePage;
