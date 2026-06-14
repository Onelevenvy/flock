import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Stack,
  Button,
  Divider,
  ScrollArea,
  Switch,
  Tooltip,
  Badge,
  Code,
} from '@mantine/core';
import {
  IconX,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
  IconChevronRight,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';

import { ToolsIcon } from '@/components/Common/Icons';
import type { McpServerInfo, Tool } from '@/pages/Skills/types';

interface McpServerDetailPanelProps {
  server: McpServerInfo;
  tools: Tool[];
  onClose: () => void;
  onRefresh: () => void;
}

export function McpServerDetailPanel({
  server,
  tools,
  onClose,
  onRefresh,
}: McpServerDetailPanelProps) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const msg = await invoke<string>('test_mcp_server', { id: server.id });
      notifications.show({ title: t('skills.mcp.connectSuccess'), message: msg, color: 'teal', autoClose: 3000 });
      onRefresh();
    } catch (e) {
      notifications.show({ title: t('skills.mcp.connectFailed'), message: String(e), color: 'red', autoClose: 5000 });
      onRefresh();
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      await invoke('set_mcp_server_enabled', { id: server.id, enabled });
      onRefresh();
    } catch (e) {
      notifications.show({ title: t('skills.mcp.actionFailed'), message: String(e), color: 'red', autoClose: 5000 });
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    try {
      await invoke('delete_mcp_server', { id: server.id });
      notifications.show({ title: t('assistant.deletedToast'), message: t('skills.mcp.deleteSuccessMsg', { name: server.name }), color: 'teal', autoClose: 3000 });
      onClose();
      onRefresh();
    } catch (e) {
      notifications.show({ title: t('skills.mcp.deleteFailed'), message: String(e), color: 'red', autoClose: 5000 });
    }
  };

  return (
    <Box
      style={{
        width: 380,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-base)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        minHeight: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Group justify="space-between" p="md" pb="sm">
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </Group>

      <Box px="md" pb="md">
        <Group gap="sm" mb="xs">
          <Box
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-subtle)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <ToolsIcon name={server.name} size={24} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }} truncate>
              {server.name}
            </Text>
            {server.is_connected ? (
              <Group gap={4}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-teal-6)' }} />
                <Text size="xs" c="dimmed">
                  {t('skills.mcp.connectedWithTools', { count: server.tool_count })}
                </Text>
              </Group>
            ) : (
              <Group gap={4}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-red-6)' }} />
                <Text size="xs" c="dimmed">
                  {t('skills.mcp.disconnected')}
                </Text>
              </Group>
            )}
          </Box>
        </Group>
      </Box>

      <Divider />

      <Box px="md" pt="md">
        <Group gap="xs" mb="sm">
          <IconChevronRight size={14} color="var(--flock-text-dim)" />
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
            {t('skills.mcp.configInfo')}
          </Text>
        </Group>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{t('skills.mcp.transport')}</Text>
            <Badge size="xs" variant="light" color="blue">{server.transport}</Badge>
          </Group>
          {server.command && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{t('skills.mcp.command')}</Text>
              <Text size="xs" truncate style={{ maxWidth: 200, fontFamily: 'var(--mantine-font-family-monospace)' }}>{server.command}</Text>
            </Group>
          )}
          {server.url && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">URL</Text>
              <Text size="xs" truncate style={{ maxWidth: 200, fontFamily: 'var(--mantine-font-family-monospace)' }}>{server.url}</Text>
            </Group>
          )}
          {server.args && (
            <Box>
              <Text size="xs" c="dimmed" mb={2}>{t('skills.mcp.args')}</Text>
              <Code block style={{ fontSize: 11, maxHeight: 60, overflow: 'auto' }}>{server.args}</Code>
            </Box>
          )}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{t('skills.mcp.deferred')}</Text>
            <Text size="xs">{server.deferred ? t('skills.mcp.yes') : t('skills.mcp.no')}</Text>
          </Group>
        </Stack>
      </Box>

      <Divider my="sm" />

      <Group px="md" gap="xs">
        <Button size="xs" variant="light" color="teal" leftSection={<IconRefresh size={14} />} loading={testing} onClick={handleTest}>
          {t('skills.mcp.testConnect')}
        </Button>
        <Switch
          size="sm"
          checked={server.enabled}
          onChange={(e) => handleToggle(e.currentTarget.checked)}
          disabled={toggling}
          label={t('skills.mcp.enabled')}
        />
        <Tooltip label={t('skills.mcp.deleteServerTooltip')}>
          <ActionIcon variant="light" color="red" size="sm" onClick={handleDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {server.last_error && (
        <Box px="md" pt="sm">
          <Group gap="xs" p="xs" style={{ borderRadius: 8, background: 'var(--mantine-color-red-light)', border: '1px solid var(--mantine-color-red-3)' }}>
            <IconAlertCircle size={14} color="var(--mantine-color-red-6)" />
            <Text size="xs" c="red">{server.last_error}</Text>
          </Group>
        </Box>
      )}

      <Group gap="xs" px="md" pt="sm" pb="sm">
        <IconChevronRight size={14} color="var(--flock-text-dim)" />
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
          {t('skills.mcp.discoveredTools')}
        </Text>
      </Group>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} px="md" pb="md">
        {tools.length > 0 ? (
          <Stack gap="xs">
            {tools.map((tool) => (
              <Box key={tool.id} p="xs" style={{ borderRadius: 8, background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)' }}>
                <Text size="xs" fw={500}>{tool.name}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>{tool.description}</Text>
              </Box>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" fs="italic">
            {server.is_connected ? t('skills.mcp.noTools') : t('skills.mcp.connectToViewTools')}
          </Text>
        )}
      </ScrollArea>
    </Box>
  );
}
