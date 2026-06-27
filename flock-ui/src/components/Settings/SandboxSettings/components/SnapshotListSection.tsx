import { useState, useEffect } from 'react';
import {
  Table,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
  Card,
  Button,
  Box,
  Autocomplete,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconTrash,
  IconRefresh,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconCamera,
  IconStar,
  IconStarFilled,
  IconInfoCircle,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

interface SnapshotItem {
  id: string;
  name: string;
  state?: string;
  snapshotState?: string;
  created?: string;
}

interface SnapshotListSectionProps {
  provider: 'e2b' | 'daytona' | 'local';
  currentDefaultSnapshot: string;
  onSetDefaultSnapshot: (name: string) => void;
  onCreateSnapshot: (name: string) => Promise<void>;
  creatingSnapshot: boolean;
}

export function SnapshotListSection({
  provider,
  currentDefaultSnapshot,
  onSetDefaultSnapshot,
  onCreateSnapshot,
  creatingSnapshot,
}: SnapshotListSectionProps) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newSnapshotName, setNewSnapshotName] = useState('');

  const defaultSnapshotName = provider === 'e2b' ? 'browser' : 'flock-playwright';

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const data = await invoke<any>('list_sandbox_templates');
      let list: SnapshotItem[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.items)) {
        list = data.items;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }
      // Filter out system-managed templates
      const userSnapshots = provider === 'e2b' 
        ? list 
        : list.filter((snap: any) => !snap.general && !snap.system && !snap.isSystem);
      setSnapshots(userSnapshots);
    } catch (e) {
      console.error('获取快照列表失败:', e);
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [provider]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    notifications.show({
      message: t('common.copied'),
      color: 'teal',
      autoClose: 1500,
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await invoke('delete_sandbox_template', { id });
      notifications.show({
        title: t('common.success'),
        message: t('settings.sandbox.deleteSnapshotSuccess'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
      fetchSnapshots();
    } catch (e) {
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    const nameOrId = newSnapshotName.trim() || defaultSnapshotName;
    const existing = snapshots.find((s) => s.name === nameOrId || s.id === nameOrId);
    if (existing) {
      await onSetDefaultSnapshot(existing.id);
      setNewSnapshotName('');
      return;
    }
    await onCreateSnapshot(nameOrId);
    setNewSnapshotName('');
    fetchSnapshots();
  };

  const renderState = (snap: SnapshotItem) => {
    const stateStr = (snap.state || snap.snapshotState || 'unknown').toLowerCase();
    let color = 'gray';
    if (stateStr === 'ready' || stateStr === 'active') color = 'teal';
    if (stateStr === 'building' || stateStr === 'creating') color = 'blue';
    if (stateStr === 'failed' || stateStr === 'error') color = 'red';

    return (
      <Badge color={color} variant="light" size="sm">
        {stateStr}
      </Badge>
    );
  };

  const isExistingSnapshot = snapshots.some(
    (s) => s.name === (newSnapshotName.trim() || defaultSnapshotName)
  );

  return (
    <Card
      style={{
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        borderRadius: 16,
      }}
      padding="xl"
    >
      {/* 创建快照模板 */}
      <Box mb="xl">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconCamera size={20} color="var(--flock-accent)" />
            <Text fw={700} size="md">
              {provider === 'e2b' ? 'E2B Custom Sandboxes / Templates' : t('settings.sandbox.createSnapshotTitle')}
            </Text>
          </Group>
        </Group>

        <Group align="flex-end" mb="md">
          <Autocomplete
            placeholder={defaultSnapshotName}
            value={newSnapshotName}
            onChange={setNewSnapshotName}
            data={snapshots.map((s) => s.name)}
            style={{ flex: 1 }}
            styles={{ input: { background: 'var(--flock-bg-surface)' } }}
          />
          <Button
            variant="filled"
            color={isExistingSnapshot ? 'teal' : 'blue'}
            onClick={handleCreate}
            loading={creatingSnapshot}
            leftSection={
              isExistingSnapshot 
                ? <IconCheck size={15} /> 
                : (provider === 'e2b' || provider === 'local') 
                ? <IconStar size={15} /> 
                : <IconCamera size={15} />
            }
          >
            {isExistingSnapshot
              ? t('settings.sandbox.useExistingSnapshot')
              : creatingSnapshot
              ? t('settings.sandbox.snapshotCreating')
              : (provider === 'e2b' || provider === 'local')
              ? t('settings.sandbox.setAsDefault')
              : t('settings.sandbox.snapshotCreateBtn')}
          </Button>
        </Group>

        <Alert
          icon={<IconInfoCircle size={16} />}
          color="blue"
          variant="light"
          radius="md"
          mb="lg"
          style={{ fontSize: 12 }}
        >
          {provider === 'e2b'
            ? 'E2B provides a pre-bundled "browser" template with all Playwright dependencies pre-installed. There is no need to manually compile browser dependencies. You can enter any of your custom E2B Template IDs above, click Star to set it as default and use it instantly.'
            : t('settings.sandbox.snapshotHint')}
        </Alert>
      </Box>

      <Divider color="var(--flock-border-subtle)" my="xl" />

      {/* 快照列表 */}
      <Box>
        <Group justify="space-between" mb="lg">
          <Text fw={700} size="md">
            {t('settings.sandbox.snapshots')}
          </Text>
          <Button
            variant="subtle"
            color="gray"
            leftSection={loading ? <Loader size="xs" color="gray" /> : <IconRefresh size={15} />}
            onClick={fetchSnapshots}
            disabled={loading}
            size="xs"
          >
            {t('common.refresh')}
          </Button>
        </Group>

        {loading && snapshots.length === 0 ? (
          <Group justify="center" p="xl">
            <Loader size="sm" color="blue" />
          </Group>
        ) : snapshots.length === 0 ? (
          <Box
            p="xl"
            style={{
              border: '1px dashed var(--flock-border-dim)',
              borderRadius: 12,
              textAlign: 'center',
            }}
          >
            <Text c="dimmed" size="sm">
              {t('settings.sandbox.noSnapshots')}
            </Text>
          </Box>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr style={{ borderColor: 'var(--flock-border-subtle)' }}>
                <Table.Th><Text size="xs" c="dimmed">{t('settings.sandbox.snapshotNameLabel')}</Text></Table.Th>
                <Table.Th><Text size="xs" c="dimmed">{t('settings.sandbox.status')}</Text></Table.Th>
                <Table.Th style={{ width: 120 }}><Text size="xs" c="dimmed" ta="right">{t('common.actions')}</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snapshots.map((snap) => {
                const isDefault = currentDefaultSnapshot === snap.name || currentDefaultSnapshot === snap.id;
                return (
                  <Table.Tr key={snap.id} style={{ borderColor: 'var(--flock-border-subtle)' }}>
                    <Table.Td>
                      <Group gap={6}>
                        <Text size="sm" fw={isDefault ? 600 : 400}>
                          {snap.name}
                        </Text>
                        <Tooltip label={t('common.copy')} withArrow>
                          <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => handleCopy(snap.name)}>
                            <IconCopy size={12} />
                          </ActionIcon>
                        </Tooltip>
                        {isDefault && (
                          <Badge size="xs" color="blue" variant="dot">
                            {t('settings.sandbox.default')}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{renderState(snap)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Tooltip
                          label={isDefault ? t('settings.sandbox.isDefault') : t('settings.sandbox.setAsDefault')}
                          withArrow
                        >
                          <ActionIcon
                            variant="subtle"
                            color={isDefault ? 'yellow' : 'gray'}
                            size="sm"
                            onClick={() => onSetDefaultSnapshot(snap.id)}
                          >
                            {isDefault ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('common.delete')} withArrow>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => handleDelete(snap.id)}
                            loading={deletingId === snap.id}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Box>
    </Card>
  );
}
