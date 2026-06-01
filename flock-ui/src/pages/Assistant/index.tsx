import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Modal,
  ScrollArea,
  Divider,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconRobot,
  IconSparkles,
  IconBrain,
  IconWand,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { type Assistant, type UpsertAssistant } from '@/types/assistant';
import { formatError } from '@/utils/error';
import {
  useAssistantsQuery,
  useCreateAssistantMutation,
  useUpdateAssistantMutation,
  useDeleteAssistantMutation,
} from '@/hooks/useAssistants';
import { AssistantCard } from './AssistantCard';
import { AssistantFormModal } from './AssistantFormModal';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { useStartAgent } from '@/hooks/useStartAgent';
import { XIAOF_AGENT } from '@/pages/Home/AssistantPicker';

export function AssistantPage() {
  const { t } = useTranslation();
  const setSelectedHomeAssistantId = useWorkspaceStore(s => s.setSelectedHomeAssistantId);
  const setActiveConversation = useWorkspaceStore(s => s.setActiveConversation);
  const setCurrentView = useUiStore(s => s.setCurrentView);
  const { startAssistant } = useStartAgent();

  const { data: assistants = [], isLoading: loading } = useAssistantsQuery();
  const createMutation = useCreateAssistantMutation();
  const updateMutation = useUpdateAssistantMutation();
  const deleteMutation = useDeleteAssistantMutation();

  const [formOpened, setFormOpened] = useState(false);
  const [editTarget, setEditTarget] = useState<Assistant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assistant | null>(null);

  const handleChat = (aId: string) => {
    const target = assistants.find(a => a.id === aId) || (aId === XIAOF_AGENT.id ? XIAOF_AGENT : null);
    if (target) {
      startAssistant(target);
    }
  };

  const handleOpenCreate = () => { setEditTarget(null); setFormOpened(true); };
  const handleOpenEdit = (a: Assistant) => { setEditTarget(a); setFormOpened(true); };

  const handleSave = async (data: Omit<UpsertAssistant, 'is_builtin' | 'sort_order'>) => {
    try {
      if (editTarget) {
        const existing = assistants.find(a => a.id === editTarget.id)!;
        await updateMutation.mutateAsync({
          id: editTarget.id,
          input: {
            ...data,
            is_builtin: existing.is_builtin,
            sort_order: existing.sort_order,
          },
        });
        notifications.show({ title: t('assistant.updatedToast'), message: data.name, color: 'teal', autoClose: 3000 });
      } else {
        await createMutation.mutateAsync(data);
        notifications.show({ title: t('assistant.createdToast'), message: data.name, color: 'teal', autoClose: 3000 });
      }
    } catch (e) {
      notifications.show({ title: t('common.failed'), message: formatError(e), color: 'red', autoClose: 5000 });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notifications.show({ title: t('assistant.deletedToast'), message: deleteTarget.name, color: 'orange', autoClose: 3000 });
      setDeleteTarget(null);
    } catch (e) {
      console.error('Failed to delete assistant:', e);
      notifications.show({ title: t('common.failed'), message: formatError(e), color: 'red', autoClose: 5000 });
    }
  };

  const builtinList = assistants.filter(a => a.is_builtin);
  const userList = assistants.filter(a => !a.is_builtin);

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
      <LoadingOverlay visible={loading} />

      {/* 页头 */}
      <Group gap="sm" px="xl" pt="md" pb="sm" justify="space-between">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" style={{ background: 'var(--flock-accent)' }}>
            <IconRobot size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
              {t('assistant.title')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('assistant.subtitle')}
            </Text>
          </Box>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          color="blue"
          size="sm"
          onClick={handleOpenCreate}
          style={{
            background: 'var(--flock-accent)',
            boxShadow: '0 2px 10px rgba(21, 90, 239, 0.25)',
          }}
        >
          {t('assistant.createBtn')}
        </Button>
      </Group>

      <Divider color="var(--flock-border-subtle)" />

      <ScrollArea style={{ flex: 1 }} px="xl" py="md">
        {/* 内置助手 */}
        {builtinList.length > 0 && (
          <Box mb="xl">
            <Group gap="xs" mb="md">
              <IconBrain size={16} color="var(--flock-accent)" />
              <Text size="sm" fw={600} c="dimmed" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {t('assistant.builtinTitle')}
              </Text>
              <Badge size="xs" variant="light" color="teal">{builtinList.length}</Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
              {builtinList.map(a => (
                <AssistantCard
                  key={a.id}
                  assistant={a}
                  onEdit={() => handleOpenEdit(a)}
                  onDelete={() => setDeleteTarget(a)}
                  onChat={() => handleChat(a.id)}
                />
              ))}
            </SimpleGrid>
          </Box>
        )}

        {/* 我的助手 */}
        <Box>
          <Group gap="xs" mb="md">
            <IconWand size={16} color="var(--flock-accent)" />
            <Text size="sm" fw={600} c="dimmed" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('assistant.myAssistantsTitle')}
            </Text>
            <Badge size="xs" variant="light" color="blue">{userList.length}</Badge>
          </Group>
          {userList.length === 0 ? (
            <Box
              py={64}
              style={{
                textAlign: 'center',
                border: '2px dashed var(--flock-border-dim)',
                borderRadius: 16,
              }}
            >
              <ThemeIcon size={56} radius="xl" variant="light" color="blue" mx="auto" mb="md">
                <IconRobot size={28} />
              </ThemeIcon>
              <Text size="sm" c="dimmed" mb={4}>
                {t('assistant.emptyTitle')}
              </Text>
              <Text size="xs" c="dimmed" mb="lg">
                {t('assistant.emptyDesc')}
              </Text>
              <Button
                leftSection={<IconSparkles size={16} />}
                variant="light"
                color="blue"
                size="sm"
                onClick={handleOpenCreate}
              >
                {t('assistant.createFirstBtn')}
              </Button>
            </Box>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
              {userList.map(a => (
                <AssistantCard
                  key={a.id}
                  assistant={a}
                  onEdit={() => handleOpenEdit(a)}
                  onDelete={() => setDeleteTarget(a)}
                  onChat={() => handleChat(a.id)}
                />
              ))}
            </SimpleGrid>
          )}
        </Box>
      </ScrollArea>

      {/* 创建/编辑弹窗 */}
      <AssistantFormModal
        opened={formOpened}
        initial={editTarget}
        onClose={() => setFormOpened(false)}
        onSave={handleSave}
      />

      {/* 删除确认 */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={
          <Group gap="xs">
            <IconTrash size={18} color="var(--mantine-color-red-5)" />
            <Text fw={600} size="md">
              {t('assistant.deleteModalTitle')}
            </Text>
          </Group>
        }
        size="sm"
        styles={{
          content: { background: 'var(--flock-bg-raised)', border: '1px solid var(--flock-border-dim)' },
          header: { background: 'var(--flock-bg-raised)', borderBottom: '1px solid var(--flock-border-subtle)' },
        }}
      >
        <Text size="sm" c="dimmed" mb="lg">
          {t('assistant.deleteModalDesc', { name: deleteTarget?.name })}
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button color="red" loading={deleteMutation.isPending} onClick={handleDeleteConfirm} leftSection={<IconTrash size={14} />}>
            {t('assistant.deleteModalConfirm')}
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
