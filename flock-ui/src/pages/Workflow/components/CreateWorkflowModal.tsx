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
} from '@mantine/core';
import { IconPlus, IconRoute } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useCreateWorkflow } from '../../../hooks/useWorkflow';

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

  const handleCreate = async () => {
    if (!name.trim()) return;
    const record = await createMutation.mutateAsync({
      name: name.trim(),
      description: desc.trim(),
      config: {
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 80, y: 200 }, data: { label: 'Start' } },
          { id: 'end-1', type: 'end', position: { x: 480, y: 200 }, data: { label: 'End' } },
        ],
        edges: [
          {
            id: 'start-1->end-1',
            source: 'start-1',
            target: 'end-1',
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'smoothstep',
          },
        ],
        metadata: {},
      },
      is_active: true,
    });
    setName('');
    setDesc('');
    onClose();
    onCreated(record.id);
  };

  const handleClose = () => {
    setName('');
    setDesc('');
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
        <TextInput
          label={t('workflow.createModal.nameLabel')}
          placeholder={t('workflow.createModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          mb="sm"
          required
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          styles={{
            input: { background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-dim)' },
          }}
        />
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
