import { useState } from 'react';
import i18n from '../../i18n';
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
  ScrollArea,
  Divider,
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
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { CreateTaskModal } from './CreateTaskModal';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import { useAssistantsQuery } from '../../hooks/useAssistants';
import {
  useCronJobsQuery,
  useToggleCronJobMutation,
  useDeleteCronJobMutation,
  useRunCronJobNowMutation,
} from '../../hooks/useCronJobs';
import type { CronJob } from './types';

function parseScheduleDesc(descStr: string | undefined | null, t: any): string {
  if (!descStr) return '';
  const trimmed = descStr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj.key) {
        let params = { ...obj.params };
        if (params.dayKey) {
          params.day = t(params.dayKey);
        }
        return t(obj.key, params);
      }
    } catch {
      return descStr;
    }
  }
  return descStr;
}

export function SchedulePage() {
  const { t } = useTranslation();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { data: jobs = [], isLoading, refetch } = useCronJobsQuery();
  const { data: assistants = [] } = useAssistantsQuery();
  const toggleMutation = useToggleCronJobMutation();
  const deleteMutation = useDeleteCronJobMutation();
  const runNowMutation = useRunCronJobNowMutation();

  const [modalOpened, setModalOpened] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  const handleToggleEnabled = async (jobId: string, current: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: jobId, enabled: !current });
      notifications.show({
        title: !current ? t('schedule.enabled') : t('schedule.disabled'),
        message: !current ? t('schedule.enabledMsg') : t('schedule.disabledMsg'),
        color: !current ? 'teal' : 'gray',
        autoClose: 2500,
      });
    } catch (e: any) {
      notifications.show({ title: t('common.failed'), message: String(e), color: 'red' });
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm(t('schedule.deleteConfirm'))) return;
    try {
      await deleteMutation.mutateAsync(jobId);
      notifications.show({ title: t('common.success'), message: t('schedule.deleteSuccess'), color: 'teal' });
    } catch (e: any) {
      notifications.show({ title: t('common.failed'), message: String(e), color: 'red' });
    }
  };

  const handleRunNow = async (job: CronJob) => {
    try {
      await runNowMutation.mutateAsync(job.id);
      notifications.show({
        title: t('schedule.triggered'),
        message: t('schedule.triggeredMsg'),
        color: 'blue',
        autoClose: 5000,
      });
    } catch (e: any) {
      notifications.show({ title: t('common.failed'), message: String(e), color: 'red' });
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
        borderRadius: '16px',
        border: '1px solid var(--flock-border-subtle)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        position: 'relative',
      }}
    >
      <LoadingOverlay visible={isLoading} />

      {/* 页头 */}
      <Group gap="sm" px="xl" pt="md" pb="sm" justify="space-between">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" style={{ background: 'var(--flock-accent)' }}>
            <IconCalendarTime size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
              {t('sidebar.schedule')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('schedule.pageDesc')}
            </Text>
          </Box>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          size="sm"
          onClick={() => { setEditingJob(null); setModalOpened(true); }}
          style={{
            background: 'var(--flock-accent)',
            boxShadow: '0 2px 10px rgba(21, 90, 239, 0.25)',
          }}
        >
          {t('schedule.newBtn')}
        </Button>
      </Group>

      <Divider color="var(--flock-border-subtle)" />

      {/* 内容区 */}
      <ScrollArea style={{ flex: 1 }} px="xl" py="md">
        {jobs.length === 0 && !isLoading ? (
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
              {t('schedule.empty')}
            </Text>
            <Text size="xs" c="dimmed" mb="lg" style={{ maxWidth: 280 }}>
              {t('schedule.emptyDesc')}
            </Text>
            <Button
              size="xs"
              leftSection={<IconPlus size={13} />}
              onClick={() => { setEditingJob(null); setModalOpened(true); }}
              style={{ background: 'var(--flock-accent)' }}
            >
              {t('schedule.newBtn')}
            </Button>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            {jobs.map(job => {
              const wsName = workspaces.find(w => w.id === job.workspace_id)?.name || job.workspace_id;
              const matchedA = assistants.find((a: any) => a.id === job.assistant_id);
              const aName = job.assistant_id === '__xiaof__'
                ? 'XiaoF'
                : ((matchedA as any)?.name || job.assistant_id);
              const aIcon = (matchedA as any)?.icon || '🤖';
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
                  {/* 卡片头：图标 + 名称 + 菜单 */}
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
                          {/* 状态呼吸灯 */}
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
                          {parseScheduleDesc(job.schedule_desc, t)}
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
                            {t('common.edit')}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => handleDelete(job.id)}
                          >
                            {t('common.delete')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                  {/* 描述 */}
                  <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 32 }}>
                    {job.description || t('schedule.noDesc')}
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
                        {t('schedule.runCount', { count: job.run_count })}
                      </Badge>
                    )}
                  </Group>

                  {/* Prompt 预览 */}
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
                      lineClamp={2}
                      style={{
                        fontFamily: 'var(--mantine-font-family-monospace)',
                        color: 'var(--flock-text-dim)',
                        lineHeight: 1.4,
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {job.prompt}
                    </Text>
                  </Box>

                  {/* 底部：时间 + 立即执行 */}
                  <Group justify="space-between" align="flex-end" pt={4} style={{ borderTop: '1px solid var(--flock-border-subtle)' }}>
                    <Stack gap={2}>
                      <Group gap={4}>
                        <IconClock size={10} color="var(--flock-text-dim)" />
                        <Text style={{ fontSize: 10, color: 'var(--flock-text-dim)' }}>
                          {job.enabled && job.schedule_kind !== 'manual'
                            ? `${t('schedule.nextRun')} ${formatTime(job.next_run_at)}`
                            : t('schedule.manualOnly')}
                        </Text>
                      </Group>
                      {job.last_run_at && (
                        <Text style={{ fontSize: 10, color: 'var(--flock-text-dim)' }}>
                          {t('schedule.lastRun')} {formatTime(job.last_run_at)}
                        </Text>
                      )}
                      {job.last_status === 'error' && job.last_error && (
                        <Tooltip label={job.last_error} withArrow multiline w={200}>
                          <Group gap={3} style={{ cursor: 'help' }}>
                            <IconAlertCircle size={10} color="#f87171" />
                            <Text style={{ fontSize: 10, color: '#f87171' }}>{t('schedule.runError')}</Text>
                          </Group>
                        </Tooltip>
                      )}
                    </Stack>

                    <Tooltip label={t('schedule.runNowTip')} withArrow>
                      <ActionIcon
                        onClick={() => handleRunNow(job)}
                        size="md"
                        radius="md"
                        variant="light"
                        color="blue"
                        loading={runNowMutation.isPending}
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
      </ScrollArea>

      <CreateTaskModal
        opened={modalOpened}
        onClose={() => { setModalOpened(false); setEditingJob(null); }}
        onSuccess={() => refetch()}
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
