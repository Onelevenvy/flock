import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  ThemeIcon,
  Modal,
  TextInput,
  Textarea,
  Stack,
} from '@mantine/core';
import { IconRoute } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useCreateWorkflow } from '@/hooks/useWorkflow';
import { IconPicker } from '@/pages/Assistant/IconPicker';

interface CreateWorkflowModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function CreateWorkflowModal({ opened, onClose, onCreated }: CreateWorkflowModalProps) {
  const { t } = useTranslation();
  const createMutation = useCreateWorkflow();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('🤖');

  const handleCreate = async () => {
    if (!name.trim()) return;
    const record = await createMutation.mutateAsync({
      name: name.trim(),
      description: desc.trim(),
      config: {
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 150, y: 200 }, data: { label: 'Start' } },
        ],
        edges: [],
        metadata: {
          icon: icon,
        },
      },
      is_active: true,
    });
    setName('');
    setDesc('');
    setIcon('🤖');
    onClose();
    onCreated(record.id);
  };

  const handleClose = () => {
    setName('');
    setDesc('');
    setIcon('🤖');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={24} radius="sm" style={{ background: 'var(--flock-accent)' }}>
            <IconRoute size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            {t('workflow.createModal.title')}
          </Text>
        </Group>
      }
      size="sm"
      centered
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 16,
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
          paddingBottom: 12,
        },
        overlay: { backdropFilter: 'blur(4px)' },
      }}
    >
      <Box py="sm">
        <Stack gap={4} mb="sm">
          <Text size="xs" fw={500} mb={2} style={{ color: 'var(--flock-text-secondary)', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#fa5252', marginRight: 4 }}>*</span>
            {t('workflow.createModal.nameAndAvatar', 'Name and Avatar')}
          </Text>
          <Group gap="xs" style={{ width: '100%', alignItems: 'center' }}>
            <IconPicker value={icon} onChange={setIcon} />
            <TextInput
              placeholder={t('workflow.createModal.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              style={{ flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              styles={{
                input: { background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)', height: 38 },
              }}
            />
          </Group>
        </Stack>
        <Textarea
          label={t('workflow.createModal.descLabel')}
          placeholder={t('workflow.createModal.descPlaceholder')}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          minRows={2}
          mb="lg"
          styles={{
            input: { background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)' },
          }}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            size="xs"
            color="blue"
            loading={createMutation.isPending}
            onClick={handleCreate}
            disabled={!name.trim()}
            style={{ background: 'var(--flock-accent)', boxShadow: '0 2px 8px rgba(21,90,239,0.2)' }}
          >
            {t('workflow.createModal.confirm')}
          </Button>
        </Group>
      </Box>
    </Modal>
  );
}
