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
  Menu,
  Avatar,
} from '@mantine/core';
import {
  IconRoute,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCalendar,
  IconBolt,
  IconArrowsShuffle,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useDeleteWorkflow, type WorkflowRecord } from '../../../hooks/useWorkflow';

interface WorkflowCardProps {
  workflow: WorkflowRecord;
  onOpen: () => void;
  onRun?: () => void;
}

export function WorkflowCard({ workflow, onOpen, onRun }: WorkflowCardProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteWorkflow();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const nodeCount = (workflow.config?.nodes as unknown[])?.length ?? 0;
  const edgeCount = (workflow.config?.edges as unknown[])?.length ?? 0;
  const updatedDate = new Date(workflow.updated_at).toLocaleDateString();

  return (
    <>
      <Box
        onClick={onOpen}
        style={{
          padding: 18,
          borderRadius: 18,
          border: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-raised)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
          transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
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

        {/* Card header */}
        <Group justify="space-between" mb={10} mt={4}>
          {workflow.config?.metadata?.icon ? (
            <Avatar
              size={46}
              radius={14}
              style={{
                background: 'var(--flock-accent-soft)',
                color: 'var(--flock-accent)',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              {workflow.config.metadata.icon as string}
            </Avatar>
          ) : (
            <ThemeIcon
              size={46}
              radius={14}
              style={{ background: 'var(--flock-accent-soft)', flexShrink: 0 }}
            >
              <IconRoute size={22} style={{ color: 'var(--flock-accent)' }} />
            </ThemeIcon>
          )}
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              >
                {t('common.edit')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(true);
                }}
              >
                {t('common.delete')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
        <Group justify="space-between" mb="xs">
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

        <Button
          variant="light"
          color="teal"
          fullWidth
          leftSection={<IconPlayerPlay size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onRun?.();
          }}
          styles={{
            root: {
              borderRadius: 10,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              background: 'rgba(20, 184, 166, 0.1)',
              color: 'var(--mantine-color-teal-6)',
              border: 'none',
            }
          }}
        >
          {t('home.explorer.runWorkflow')}
        </Button>
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
