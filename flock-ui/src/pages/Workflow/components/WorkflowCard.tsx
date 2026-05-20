import {
  Box,
  Text,
  Group,
  ThemeIcon,
  ActionIcon,
  Badge,
  Divider,
  Modal,
  Button,
} from '@mantine/core';
import {
  IconRoute,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconBolt,
  IconArrowsShuffle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useDeleteWorkflow, type WorkflowRecord } from '../../../hooks/useWorkflow';

interface WorkflowCardProps {
  workflow: WorkflowRecord;
  onOpen: () => void;
}

export function WorkflowCard({ workflow, onOpen }: WorkflowCardProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteWorkflow();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const nodeCount = (workflow.config?.nodes as unknown[])?.length ?? 0;
  const edgeCount = (workflow.config?.edges as unknown[])?.length ?? 0;
  const updatedDate = new Date(workflow.updated_at).toLocaleDateString();

  return (
    <>
      <Box
        className="hover-card-lift"
        onClick={onOpen}
        style={{
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid var(--flock-border-dim)',
          background: 'var(--flock-bg-raised)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Accent top strip */}
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--flock-accent)',
            borderRadius: '12px 12px 0 0',
          }}
        />

        {/* Card header */}
        <Group justify="space-between" mb={10} mt={4}>
          <ThemeIcon
            size={32}
            radius="md"
            style={{ background: 'var(--flock-accent-soft)', flexShrink: 0 }}
          >
            <IconRoute size={17} style={{ color: 'var(--flock-accent)' }} />
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
              <IconEdit size={13} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(true);
              }}
            >
              <IconTrash size={13} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Name */}
        <Text
          fw={600}
          size="sm"
          lineClamp={1}
          mb={4}
          style={{ color: 'var(--flock-text-bright)' }}
        >
          {workflow.name}
        </Text>

        {/* Description */}
        <Text size="xs" c="dimmed" lineClamp={2} mb="sm" style={{ minHeight: 30 }}>
          {workflow.description || t('workflow.card.noDesc')}
        </Text>

        <Divider mb="sm" color="var(--flock-border-subtle)" />

        {/* Footer stats */}
        <Group justify="space-between">
          <Group gap={5}>
            <Badge
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconBolt size={9} />}
            >
              {nodeCount} {t('workflow.card.nodes')}
            </Badge>
            <Badge
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconArrowsShuffle size={9} />}
            >
              {edgeCount} {t('workflow.card.edges')}
            </Badge>
          </Group>
          <Group gap={3}>
            <IconCalendar size={10} style={{ color: 'var(--flock-text-muted)' }} />
            <Text size="xs" c="dimmed">
              {updatedDate}
            </Text>
          </Group>
        </Group>
      </Box>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title={
          <Group gap="xs">
            <IconTrash size={16} style={{ color: 'var(--mantine-color-red-5)' }} />
            <Text fw={600} size="sm">
              {t('workflow.deleteModal.title')}
            </Text>
          </Group>
        }
        size="xs"
        centered
        styles={{
          content: {
            background: 'var(--flock-bg-raised)',
            border: '1px solid var(--flock-border-dim)',
            borderRadius: 14,
          },
          header: { background: 'var(--flock-bg-raised)', borderBottom: '1px solid var(--flock-border-subtle)' },
          overlay: { backdropFilter: 'blur(4px)' },
        }}
      >
        <Text size="sm" c="dimmed" mb="lg">
          {t('workflow.deleteModal.desc', { name: workflow.name })}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => setDeleteConfirm(false)}
            disabled={deleteMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            size="xs"
            loading={deleteMutation.isPending}
            onClick={async () => {
              await deleteMutation.mutateAsync(workflow.id);
              setDeleteConfirm(false);
            }}
            leftSection={<IconTrash size={12} />}
          >
            {t('workflow.deleteModal.confirm')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
