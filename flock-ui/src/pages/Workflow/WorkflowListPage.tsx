import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  SimpleGrid,
  ThemeIcon,
  Modal,
  ScrollArea,
  Divider,
  LoadingOverlay,
  TextInput,
  Textarea,
  ActionIcon,
  Badge,
  Paper,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconRoute,
  IconEdit,
  IconPlayerPlay,
  IconCalendar,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  useWorkflowsQuery,
  useCreateWorkflow,
  useDeleteWorkflow,
  type WorkflowRecord,
} from '../../hooks/useWorkflow';
import { useWorkflowStore } from '../../store/workflowStore';

interface WorkflowListPageProps {
  onOpenEditor: (id: string) => void;
}

export function WorkflowListPage({ onOpenEditor }: WorkflowListPageProps) {
  const { t } = useTranslation();
  const { data: workflows = [], isLoading } = useWorkflowsQuery();
  const createMutation = useCreateWorkflow();
  const deleteMutation = useDeleteWorkflow();

  const [createOpened, setCreateOpened] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowRecord | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const record = await createMutation.mutateAsync({
      name: newName.trim(),
      description: newDesc.trim(),
      config: {
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 80, y: 200 },
            data: { label: 'Start' },
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 480, y: 200 },
            data: { label: 'End' },
          },
        ],
        edges: [],
        metadata: {},
      },
      is_active: true,
    });
    setCreateOpened(false);
    setNewName('');
    setNewDesc('');
    onOpenEditor(record.id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
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
            <IconRoute size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
              {t('workflow.title')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('workflow.subtitle')}
            </Text>
          </Box>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          color="blue"
          size="sm"
          onClick={() => setCreateOpened(true)}
          style={{
            background: 'var(--flock-accent)',
            boxShadow: '0 2px 10px rgba(21, 90, 239, 0.25)',
          }}
        >
          {t('workflow.createBtn')}
        </Button>
      </Group>

      <Divider color="var(--flock-border-subtle)" />

      <ScrollArea style={{ flex: 1 }} px="xl" py="md">
        {workflows.length === 0 ? (
          <Box
            py={80}
            style={{
              textAlign: 'center',
              border: '2px dashed var(--flock-border-dim)',
              borderRadius: 16,
              marginTop: 24,
            }}
          >
            <ThemeIcon size={56} radius="xl" variant="light" color="blue" mx="auto" mb="md">
              <IconRoute size={28} />
            </ThemeIcon>
            <Text size="sm" c="dimmed" mb={4}>
              {t('workflow.emptyTitle')}
            </Text>
            <Text size="xs" c="dimmed" mb="lg">
              {t('workflow.emptyDesc')}
            </Text>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              color="blue"
              size="sm"
              onClick={() => setCreateOpened(true)}
            >
              {t('workflow.createBtn')}
            </Button>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onOpen={() => onOpenEditor(wf.id)}
                onDelete={() => setDeleteTarget(wf)}
              />
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>

      {/* 创建弹窗 */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={
          <Group gap="xs">
            <IconPlus size={18} />
            <Text fw={600}>{t('workflow.createModal.title')}</Text>
          </Group>
        }
        size="sm"
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
        <Box py="sm">
          <TextInput
            label={t('workflow.createModal.nameLabel')}
            placeholder={t('workflow.createModal.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            mb="sm"
            required
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Textarea
            label={t('workflow.createModal.descLabel')}
            placeholder={t('workflow.createModal.descPlaceholder')}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            minRows={2}
            mb="lg"
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCreateOpened(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              color="blue"
              loading={createMutation.isPending}
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={{ background: 'var(--flock-accent)' }}
            >
              {t('workflow.createModal.confirm')}
            </Button>
          </Group>
        </Box>
      </Modal>

      {/* 删除确认 */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={
          <Group gap="xs">
            <IconTrash size={18} color="var(--mantine-color-red-5)" />
            <Text fw={600} size="md">
              {t('workflow.deleteModal.title')}
            </Text>
          </Group>
        }
        size="sm"
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
        <Text size="sm" c="dimmed" mb="lg">
          {t('workflow.deleteModal.desc', { name: deleteTarget?.name })}
        </Text>
        <Group justify="flex-end">
          <Button
            variant="subtle"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            loading={deleteMutation.isPending}
            onClick={handleDeleteConfirm}
            leftSection={<IconTrash size={14} />}
          >
            {t('workflow.deleteModal.confirm')}
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

// ── Workflow Card ────────────────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: WorkflowRecord;
  onOpen: () => void;
  onDelete: () => void;
}

function WorkflowCard({ workflow, onOpen, onDelete }: WorkflowCardProps) {
  const { t } = useTranslation();
  const nodeCount =
    (workflow.config?.nodes as unknown[])?.length ?? 0;
  const edgeCount =
    (workflow.config?.edges as unknown[])?.length ?? 0;
  const updatedDate = new Date(workflow.updated_at).toLocaleDateString();

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow =
          '0 8px 24px rgba(0,0,0,0.1)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--flock-accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.borderColor =
          'var(--flock-border-subtle)';
      }}
    >
      {/* Colored top bar */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, var(--flock-accent), #60a5fa)',
          borderRadius: '12px 12px 0 0',
        }}
      />

      <Group justify="space-between" mb="xs" mt={4}>
        <ThemeIcon size={32} radius="md" variant="light" color="blue">
          <IconRoute size={18} />
        </ThemeIcon>
        <Group gap={4}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="blue"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Text fw={600} size="sm" lineClamp={1} mb={4} style={{ color: 'var(--flock-text-bright)' }}>
        {workflow.name}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={2} mb="sm" style={{ minHeight: 32 }}>
        {workflow.description || t('workflow.card.noDesc')}
      </Text>

      <Divider mb="sm" color="var(--flock-border-subtle)" />

      <Group justify="space-between">
        <Group gap={6}>
          <Badge size="xs" variant="light" color="blue">
            {nodeCount} {t('workflow.card.nodes')}
          </Badge>
          <Badge size="xs" variant="light" color="gray">
            {edgeCount} {t('workflow.card.edges')}
          </Badge>
        </Group>
        <Group gap={4}>
          <IconCalendar size={11} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed">{updatedDate}</Text>
        </Group>
      </Group>
    </Paper>
  );
}
