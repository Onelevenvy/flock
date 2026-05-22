import {
  Stack,
  Text,
  Group,
  Badge,
  Alert,
  Button,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconCamera,
  IconHelpCircle,
  IconInfoCircle,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface SandboxSnapshotSectionProps {
  snapshot: string;
  onSnapshotChange: (val: string) => void;
  onCreateSnapshot: () => void;
  creatingSnapshot: boolean;
  defaultSnapshotName: string;
}

export function SandboxSnapshotSection({
  snapshot,
  onSnapshotChange,
  onCreateSnapshot,
  creatingSnapshot,
  defaultSnapshotName,
}: SandboxSnapshotSectionProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xs">
      <TextInput
        label={
          <Group gap={6} style={{ marginBottom: 4 }}>
            <IconCamera size={14} color="var(--flock-text-dim)" />
            <Text size="sm" fw={500}>{t('settings.sandbox.snapshotName')}</Text>
            <Tooltip
              label={t('settings.sandbox.snapshotTooltip')}
              multiline
              w={300}
              withArrow
              position="top"
            >
              <IconHelpCircle size={13} color="var(--flock-text-dim)" style={{ cursor: 'help' }} />
            </Tooltip>
            {snapshot.trim() && (
              <Badge size="xs" color="teal" variant="dot">
                {t('settings.sandbox.snapshotActive')}
              </Badge>
            )}
          </Group>
        }
        placeholder={defaultSnapshotName}
        value={snapshot}
        onChange={(e) => onSnapshotChange(e.currentTarget.value)}
        styles={{ input: { background: 'var(--flock-bg-surface)' } }}
      />

      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        variant="light"
        radius="md"
        style={{ fontSize: 12 }}
      >
        {t('settings.sandbox.snapshotHint')}
      </Alert>

      <Button
        variant="outline"
        color="violet"
        size="sm"
        leftSection={<IconCamera size={15} />}
        onClick={onCreateSnapshot}
        loading={creatingSnapshot}
        style={{ alignSelf: 'flex-start' }}
      >
        {creatingSnapshot
          ? t('settings.sandbox.snapshotCreating')
          : t('settings.sandbox.snapshotCreateBtn')}
      </Button>
    </Stack>
  );
}
