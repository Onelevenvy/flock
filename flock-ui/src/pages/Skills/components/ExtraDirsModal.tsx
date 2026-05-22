import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Text,
  Group,
  Stack,
  Button,
  Tooltip,
  Modal,
  ActionIcon,
} from '@mantine/core';
import {
  IconFolderPlus,
  IconTrash,
  IconFolder,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

export function ExtraDirsModal({
  opened,
  onClose,
  onUpdate,
}: {
  opened: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const [dirs, setDirs] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const fetchDirs = useCallback(() => {
    invoke<string[]>('get_extra_skill_dirs').then(setDirs).catch(console.error);
  }, []);

  useEffect(() => {
    if (opened) {
      fetchDirs();
    }
  }, [opened, fetchDirs]);

  const handleSelectAndAdd = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setAdding(true);
        const updated = await invoke<string[]>('add_extra_skill_dir', { path: selected });
        setDirs(updated);
        onUpdate();
        notifications.show({ title: t('skills.skills.importSuccess'), message: t('skills.skills.importSuccessMsg'), color: 'teal', autoClose: 3000 });
      }
    } catch (e: any) {
      notifications.show({ title: t('skills.skills.importFailed'), message: String(e), color: 'red', autoClose: 5000 });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (path: string) => {
    try {
      const updated = await invoke<string[]>('remove_extra_skill_dir', { path });
      setDirs(updated);
      onUpdate();
      notifications.show({ title: t('skills.skills.removedToast'), message: t('skills.skills.removedToastMsg'), color: 'teal', autoClose: 3000 });
    } catch (e: any) {
      notifications.show({ title: t('skills.skills.removeFailed'), message: String(e), color: 'red', autoClose: 5000 });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('skills.skills.manageModalTitle')}
      size="md"
      styles={{ title: { fontWeight: 600 } }}
    >
      <Stack gap="md" pt="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">{t('skills.skills.manageModalDesc')}</Text>
          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<IconFolderPlus size={14} />}
            loading={adding}
            onClick={handleSelectAndAdd}
          >
            {t('skills.skills.selectFolderBtn')}
          </Button>
        </Group>

        {dirs.length > 0 ? (
          <Stack gap="xs">
            {dirs.map((d) => (
              <Group key={d} gap="xs" p="xs" style={{ borderRadius: 8, border: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
                <IconFolder size={16} color="var(--flock-text-dim)" />
                <Text size="sm" style={{ flex: 1, fontFamily: 'var(--mantine-font-family-monospace)', wordBreak: 'break-all' }}>
                  {d}
                </Text>
                <Tooltip label={t('skills.skills.removeTooltip')}>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemove(d)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        ) : (
          <Box py="xl" style={{ textAlign: 'center' }}>
            <Text size="sm" c="dimmed">{t('skills.skills.noDirs')}</Text>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
