import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  SimpleGrid,
  LoadingOverlay,
  ThemeIcon,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  IconCalendarTime,
  IconPlus,
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
import { EmptyState } from './components/EmptyState';
import { CronJobCard } from './components/CronJobCard';

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

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: 'var(--flock-bg-surface)',
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
          <EmptyState
            t={t}
            onNew={() => { setEditingJob(null); setModalOpened(true); }}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            {jobs.map(job => (
              <CronJobCard
                key={job.id}
                job={job}
                t={t}
                workspaces={workspaces}
                assistants={assistants}
                onToggle={handleToggleEnabled}
                onDelete={handleDelete}
                onEdit={(selectedJob) => { setEditingJob(selectedJob); setModalOpened(true); }}
                onRunNow={handleRunNow}
                runNowPending={runNowMutation.isPending}
              />
            ))}
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
