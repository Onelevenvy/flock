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
  TextInput,
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
  currentDefaultSnapshot: string;
  onSetDefaultSnapshot: (name: string) => void;
  onCreateSnapshot: (name: string) => Promise<void>;
  creatingSnapshot: boolean;
}

export function SnapshotListSection({
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

  const defaultSnapshotName = 'flock-playwright';

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const data = await invoke<any>('list_daytona_snapshots');
      let list: SnapshotItem[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.items)) {
        list = data.items;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }
      // Filter out system-managed templates
      const userSnapshots = list.filter((snap: any) => !snap.system && !snap.isSystem);
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
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    notifications.show({
      message: t('common.copied', { defaultValue: '已复制到剪贴板' }),
      color: 'teal',
      autoClose: 1500,
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await invoke('delete_daytona_snapshot', { id });
      notifications.show({
        title: t('common.success'),
        message: t('settings.sandbox.deleteSnapshotSuccess', { defaultValue: '快照已删除' }),
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
    const name = newSnapshotName.trim() || defaultSnapshotName;
    await onCreateSnapshot(name);
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
              {t('settings.sandbox.createSnapshotTitle', { defaultValue: '创建新快照模板' })}
            </Text>
          </Group>
        </Group>

        <Group align="flex-end" mb="md">
          <TextInput
            placeholder={defaultSnapshotName}
            value={newSnapshotName}
            onChange={(e) => setNewSnapshotName(e.currentTarget.value)}
            style={{ flex: 1 }}
            styles={{ input: { background: 'var(--flock-bg-surface)' } }}
          />
          <Button
            variant="filled"
            color="blue"
            onClick={handleCreate}
            loading={creatingSnapshot}
            leftSection={<IconCamera size={15} />}
          >
            {creatingSnapshot ? t('settings.sandbox.snapshotCreating') : t('settings.sandbox.snapshotCreateBtn')}
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
          {t('settings.sandbox.snapshotHint')}
        </Alert>
      </Box>

      <Divider color="var(--flock-border-subtle)" my="xl" />

      {/* 快照列表 */}
      <Box>
        <Group justify="space-between" mb="lg">
          <Text fw={700} size="md">
            {t('settings.sandbox.snapshots', { defaultValue: '云端快照模板' })}
          </Text>
          <Button
            variant="subtle"
            color="gray"
            leftSection={loading ? <Loader size="xs" color="gray" /> : <IconRefresh size={15} />}
            onClick={fetchSnapshots}
            disabled={loading}
            size="xs"
          >
            {t('common.refresh', { defaultValue: '刷新' })}
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
              {t('settings.sandbox.noSnapshots', { defaultValue: '暂无快照模板' })}
            </Text>
          </Box>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr style={{ borderColor: 'var(--flock-border-subtle)' }}>
                <Table.Th><Text size="xs" c="dimmed">{t('settings.sandbox.snapshotNameLabel', { defaultValue: '名称' })}</Text></Table.Th>
                <Table.Th><Text size="xs" c="dimmed">{t('settings.sandbox.status', { defaultValue: '状态' })}</Text></Table.Th>
                <Table.Th style={{ width: 120 }}><Text size="xs" c="dimmed" ta="right">{t('common.actions', { defaultValue: '操作' })}</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snapshots.map((snap) => {
                const isDefault = currentDefaultSnapshot === snap.name;
                return (
                  <Table.Tr key={snap.id} style={{ borderColor: 'var(--flock-border-subtle)' }}>
                    <Table.Td>
                      <Group gap={6}>
                        <Text size="sm" fw={isDefault ? 600 : 400}>
                          {snap.name}
                        </Text>
                        <Tooltip label={t('common.copy', { defaultValue: '复制名称' })} withArrow>
                          <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => handleCopy(snap.name)}>
                            <IconCopy size={12} />
                          </ActionIcon>
                        </Tooltip>
                        {isDefault && (
                          <Badge size="xs" color="blue" variant="dot">
                            {t('settings.sandbox.default', { defaultValue: '默认' })}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{renderState(snap)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Tooltip
                          label={isDefault ? t('settings.sandbox.isDefault', { defaultValue: '当前已是默认模板' }) : t('settings.sandbox.setAsDefault', { defaultValue: '设为默认模板' })}
                          withArrow
                        >
                          <ActionIcon
                            variant="subtle"
                            color={isDefault ? 'yellow' : 'gray'}
                            size="sm"
                            onClick={() => onSetDefaultSnapshot(snap.name)}
                          >
                            {isDefault ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('common.delete', { defaultValue: '删除' })} withArrow>
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
