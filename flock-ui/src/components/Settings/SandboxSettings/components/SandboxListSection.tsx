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
} from '@mantine/core';
import {
  IconTrash,
  IconRefresh,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconCpu,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

interface SandboxItem {
  id: string;
  state?: string;
  status?: string;
  snapshot?: string;
  created?: string;
}

export function SandboxListSection() {
  const { t } = useTranslation();
  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  const fetchSandboxes = async () => {
    setLoading(true);
    try {
      const data = await invoke<any>('list_sandboxes');
      // 解析 sandboxes 数组
      let list: SandboxItem[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.items)) {
        list = data.items;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }
      setSandboxes(list);
    } catch (e) {
      console.error('获取沙盒列表失败:', e);
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setCleaningUp(true);
    try {
      const msg = await invoke<string>('cleanup_all_sandboxes');
      notifications.show({
        title: t('settings.sandbox.cleanupDone'),
        message: msg,
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
      fetchSandboxes();
    } catch (e) {
      notifications.show({
        title: t('settings.sandbox.cleanupFailed'),
        message: String(e),
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setCleaningUp(false);
    }
  };

  useEffect(() => {
    fetchSandboxes();
  }, []);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    notifications.show({
      message: t('common.copied'),
      color: 'teal',
      autoClose: 1500,
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await invoke('delete_sandbox', { id });
      notifications.show({
        title: t('common.success'),
        message: t('settings.sandbox.deleteSuccessMsg'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
      fetchSandboxes();
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

  const renderStatus = (sb: SandboxItem) => {
    const stateStr = (sb.state || sb.status || 'unknown').toLowerCase();
    let color = 'gray';
    if (stateStr === 'started' || stateStr === 'running') color = 'teal';
    if (stateStr === 'stopped') color = 'orange';
    if (stateStr === 'error' || stateStr === 'failed') color = 'red';

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
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <IconCpu size={20} color="var(--flock-accent)" />
          <Text fw={700} size="md">
            {t('settings.sandbox.activeInstances')}
          </Text>
        </Group>
        <Group gap="xs">
          <Button
            variant="outline"
            color="red"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={handleCleanup}
            loading={cleaningUp}
          >
            {t('settings.sandbox.cleanupBtn')}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            leftSection={loading ? <Loader size="xs" color="gray" /> : <IconRefresh size={15} />}
            onClick={fetchSandboxes}
            disabled={loading}
            size="xs"
          >
            {t('common.refresh')}
          </Button>
        </Group>
      </Group>

      {loading && sandboxes.length === 0 ? (
        <Group justify="center" p="xl">
          <Loader size="sm" color="blue" />
        </Group>
      ) : sandboxes.length === 0 ? (
        <Box
          p="xl"
          style={{
            border: '1px dashed var(--flock-border-dim)',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <Text c="dimmed" size="sm">
            {t('settings.sandbox.noActiveInstances')}
          </Text>
        </Box>
      ) : (
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr style={{ borderColor: 'var(--flock-border-subtle)' }}>
              <Table.Th><Text size="xs" c="dimmed">ID</Text></Table.Th>
              <Table.Th><Text size="xs" c="dimmed">{t('settings.sandbox.status')}</Text></Table.Th>
              <Table.Th><Text size="xs" c="dimmed">{t('settings.sandbox.snapshot')}</Text></Table.Th>
              <Table.Th style={{ width: 80 }}><Text size="xs" c="dimmed" ta="right">{t('common.actions')}</Text></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sandboxes.map((sb) => (
              <Table.Tr key={sb.id} style={{ borderColor: 'var(--flock-border-subtle)' }}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {sb.id.substring(0, 8)}...
                    </Text>
                    <Tooltip label={t('common.copy')} withArrow>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => handleCopyId(sb.id)}>
                        <IconCopy size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
                <Table.Td>{renderStatus(sb)}</Table.Td>
                <Table.Td>
                  <Text size="sm" c={sb.snapshot ? 'var(--flock-text-base)' : 'dimmed'}>
                    {sb.snapshot || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <Tooltip label={t('common.delete')} withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleDelete(sb.id)}
                        loading={deletingId === sb.id}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  );
}
