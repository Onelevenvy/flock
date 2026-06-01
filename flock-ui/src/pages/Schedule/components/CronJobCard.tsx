import {
  Box,
  Text,
  Group,
  Switch,
  ActionIcon,
  Menu,
  Avatar,
  Badge,
  Stack,
  Tooltip,
} from '@mantine/core';
import {
  IconCalendarTime,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconFolder,
  IconRobot,
  IconClock,
  IconAlertCircle,
  IconPlayerPlay,
} from '@tabler/icons-react';
import type { CronJob } from '@/pages/Schedule/types';
import { parseScheduleDesc, formatTime } from '@/pages/Schedule/utils';

interface CronJobCardProps {
  job: CronJob;
  t: any;
  workspaces: any[];
  assistants: any[];
  onToggle: (jobId: string, current: boolean) => void;
  onDelete: (jobId: string) => void;
  onEdit: (job: CronJob) => void;
  onRunNow: (job: CronJob) => void;
  runNowPending: boolean;
}

export function CronJobCard({
  job,
  t,
  workspaces,
  assistants,
  onToggle,
  onDelete,
  onEdit,
  onRunNow,
  runNowPending,
}: CronJobCardProps) {
  const wsName = workspaces.find(w => w.id === job.workspace_id)?.name || job.workspace_id;
  const matchedA = assistants.find((a: any) => a.id === job.assistant_id);
  const aName = job.assistant_id === '__xiaof__'
    ? 'XiaoF'
    : ((matchedA as any)?.name || job.assistant_id);
  const aIcon = (matchedA as any)?.icon || '🤖';
  const isRunning = job.enabled && job.last_status !== 'error';

  return (
    <Box
      p="md"
      style={{
        borderRadius: 18,
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--flock-accent)';
        e.currentTarget.style.boxShadow = '0 14px 36px rgba(21, 90, 239, 0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--flock-border-subtle)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.05)';
      }}
    >
      {/* 卡片头：图标 + 名称 + 菜单 */}
      <Group gap="sm" wrap="nowrap" justify="space-between">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar
            size={46}
            radius={14}
            style={{
              background: job.enabled ? 'var(--flock-accent-soft)' : 'var(--flock-bg-hover)',
              color: job.enabled ? 'var(--flock-accent)' : 'var(--flock-text-dim)',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <IconCalendarTime size={22} />
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
            onChange={() => onToggle(job.id, job.enabled)}
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
                onClick={() => onEdit(job)}
              >
                {t('common.edit')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={() => onDelete(job.id)}
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
          borderRadius: 12,
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
            onClick={() => onRunNow(job)}
            size="md"
            radius="md"
            variant="light"
            color="blue"
            loading={runNowPending}
            style={{ background: 'var(--flock-accent-soft)' }}
          >
            <IconPlayerPlay size={15} fill="currentColor" />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
}
