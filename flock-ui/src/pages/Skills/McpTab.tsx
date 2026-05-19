import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  SimpleGrid,
  Badge,
  Group,
  LoadingOverlay,
  ThemeIcon,
  ActionIcon,
  Stack,
  Button,
  Divider,
  ScrollArea,
  Modal,
  TextInput,
  Select,
  Checkbox,
  Code,
  Switch,
  Tooltip,
} from '@mantine/core';
import {
  IconX,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconServer,
  IconAlertCircle,
  IconChevronRight,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { McpServerInfo, Tool } from './types';
import { ToolsIcon } from '../../components/Icons';

function McpServerDetailPanel({
  server,
  tools,
  onClose,
  onRefresh,
}: {
  server: McpServerInfo;
  tools: Tool[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const msg = await invoke<string>('test_mcp_server', { id: server.id });
      notifications.show({ title: t('skills.mcp.connectSuccess'), message: msg, color: 'teal', autoClose: 3000 });
      onRefresh();
    } catch (e: any) {
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
    } catch (e: any) {
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
    } catch (e: any) {
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
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#51cf66' }} />
                <Text size="xs" c="dimmed">
                  {t('skills.mcp.connectedWithTools', { count: server.tool_count })}
                </Text>
              </Group>
            ) : (
              <Group gap={4}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b6b' }} />
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

function McpServerFormModal({
  opened,
  onClose,
  onSave,
  editServer,
}: {
  opened: boolean;
  onClose: () => void;
  onSave: () => void;
  editServer?: McpServerInfo | null;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<string>('streamable-http');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [env, setEnv] = useState('');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [deferred, setDeferred] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editServer) {
      setName(editServer.name);
      setTransport(editServer.transport);
      setCommand(editServer.command || '');
      setArgs(editServer.args || '');
      setEnv(editServer.env || '');
      setUrl(editServer.url || '');
      setHeaders(editServer.headers || '');
      setDeferred(editServer.deferred);
    } else {
      setName('');
      setTransport('streamable-http');
      setCommand('');
      setArgs('');
      setEnv('');
      setUrl('');
      setHeaders('');
      setDeferred(true);
    }
  }, [editServer, opened]);

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({ title: t('skills.mcp.nameRequired'), message: t('skills.mcp.nameRequiredMsg'), color: 'red', autoClose: 3000 });
      return;
    }
    setSaving(true);
    try {
      const server: McpServerInfo = {
        id: editServer?.id || `mcp:${name.trim()}`,
        name: name.trim(),
        transport: transport as McpServerInfo['transport'],
        command: transport === 'stdio' ? command.trim() || null : null,
        args: transport === 'stdio' && args.trim() ? args.trim() : null,
        env: transport === 'stdio' && env.trim() ? env.trim() : null,
        url: transport !== 'stdio' ? url.trim() || null : null,
        headers: transport !== 'stdio' && headers.trim() ? headers.trim() : null,
        deferred,
        is_connected: editServer?.is_connected || false,
        last_error: editServer?.last_error || null,
        tool_count: editServer?.tool_count || 0,
        enabled: editServer?.enabled ?? true,
        created_at: editServer?.created_at || '',
        updated_at: editServer?.updated_at || '',
      };
      await invoke('upsert_mcp_server', { server });
      notifications.show({
        title: editServer ? t('skills.mcp.updatedToast') : t('skills.mcp.addedToast'),
        message: t('skills.mcp.upsertSuccessMsg', { name: name.trim(), action: editServer ? t('skills.mcp.updatedToast') : t('skills.mcp.addedToast') }),
        color: 'teal',
        autoClose: 3000,
      });
      onSave();
      onClose();
    } catch (e: any) {
      notifications.show({ title: t('common.failed'), message: String(e), color: 'red', autoClose: 5000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editServer ? t('skills.mcp.editTitle') : t('skills.mcp.createTitle')}
      size="md"
      styles={{ title: { fontWeight: 600 } }}
    >
      <Stack gap="md">
        <TextInput
          label={t('skills.mcp.serverName')}
          placeholder="例如: filesystem, github"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          disabled={!!editServer}
        />

        <Select
          label={t('skills.mcp.transport')}
          value={transport}
          onChange={(v) => setTransport(v || 'streamable-http')}
          data={[
            { value: 'streamable-http', label: 'Streamable HTTP' },
            { value: 'sse', label: 'SSE (Server-Sent Events)' },
            { value: 'stdio', label: 'Stdio (本地进程)' },
          ]}
        />

        {transport === 'stdio' ? (
          <>
            <TextInput
              label={t('skills.mcp.command')}
              placeholder="例如: npx, node, python"
              value={command}
              onChange={(e) => setCommand(e.currentTarget.value)}
              description={t('skills.mcp.commandDesc')}
            />
            <TextInput
              label={t('skills.mcp.args')}
              placeholder='例如: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]'
              value={args}
              onChange={(e) => setArgs(e.currentTarget.value)}
              description={t('skills.mcp.argsDesc')}
            />
            <TextInput
              label={t('skills.mcp.env')}
              placeholder='例如: {"API_KEY": "xxx"}'
              value={env}
              onChange={(e) => setEnv(e.currentTarget.value)}
              description={t('skills.mcp.envDesc')}
            />
          </>
        ) : (
          <>
            <TextInput
              label="URL"
              placeholder="例如: http://localhost:3000/mcp"
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
              description={t('skills.mcp.urlDesc')}
            />
            <TextInput
              label={t('skills.mcp.headers')}
              placeholder='例如: {"Authorization": "Bearer xxx"}'
              value={headers}
              onChange={(e) => setHeaders(e.currentTarget.value)}
              description={t('skills.mcp.headersDesc')}
            />
          </>
        )}

        <Checkbox
          label={t('skills.mcp.deferredDesc')}
          checked={deferred}
          onChange={(e) => setDeferred(e.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={onClose}>{t('common.cancel')}</Button>
          <Button color="blue" loading={saving} onClick={handleSave}>
            {editServer ? t('common.confirm') : t('common.add')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function McpTab() {
  const { t } = useTranslation();
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<McpServerInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editServer, setEditServer] = useState<McpServerInfo | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      invoke<McpServerInfo[]>('list_mcp_servers'),
      invoke<Tool[]>('list_tools'),
    ])
      .then(([s, t]) => { setServers(s); setTools(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (selectedServer) {
      const fresh = servers.find((s) => s.id === selectedServer.id);
      if (fresh && fresh !== selectedServer) setSelectedServer(fresh);
    }
  }, [servers, selectedServer]);

  const selectedTools = selectedServer
    ? tools.filter((t) => t.provider_id === `mcp:${selectedServer.name}`)
    : [];

  return (
    <Box style={{ height: '100%', display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' }}>
      <LoadingOverlay visible={loading} />

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Group justify="flex-end" mb="md">
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconPlus size={14} />}
            onClick={() => { setEditServer(null); setShowForm(true); }}
          >
            {t('skills.mcp.createTitle')}
          </Button>
        </Group>

        {servers.length === 0 && !loading ? (
          <Box py={48} style={{ textAlign: 'center' }}>
            <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="md">
              <IconServer size={24} />
            </ThemeIcon>
            <Text c="dimmed" size="sm">{t('skills.mcp.noServers')}</Text>
            <Text c="dimmed" size="xs" mt={4}>{t('skills.mcp.clickToAdd')}</Text>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {servers.map((server) => (
              <Box
                key={server.id}
                p="md"
                onClick={() => setSelectedServer(server)}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${selectedServer?.id === server.id ? 'var(--flock-accent)' : 'var(--flock-border-subtle)'}`,
                  background: selectedServer?.id === server.id ? 'var(--flock-accent-soft)' : 'var(--flock-bg-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: server.enabled ? 1 : 0.6,
                }}
                className="hover-card-lift"
              >
                <Group gap="sm" mb="sm">
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      background: 'var(--flock-bg-surface)',
                      border: '1px solid var(--flock-border-subtle)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                  >
                    <ToolsIcon name={server.name} size={20} />
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate style={{ color: 'var(--flock-text-bright)' }}>
                      {server.name}
                    </Text>
                  </Box>
                </Group>

                <Group gap={6} mb="sm">
                  <Badge size="xs" variant="light" color="blue">{server.transport}</Badge>
                  {server.is_connected ? (
                    <Badge size="xs" variant="light" color="green">{t('skills.tools.available')}</Badge>
                  ) : (
                    <Badge size="xs" variant="light" color="red">{t('skills.mcp.disconnected')}</Badge>
                  )}
                  {!server.enabled && (
                    <Badge size="xs" variant="light" color="gray">{t('skills.mcp.disabled')}</Badge>
                  )}
                </Group>

                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    {t('skills.mcp.toolsCount', { count: server.tool_count })}
                  </Text>
                  {server.last_error && (
                    <Tooltip label={server.last_error}>
                      <IconAlertCircle size={14} color="var(--mantine-color-red-5)" />
                    </Tooltip>
                  )}
                </Group>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>

      {selectedServer && (
        <McpServerDetailPanel
          server={selectedServer}
          tools={selectedTools}
          onClose={() => setSelectedServer(null)}
          onRefresh={fetchData}
        />
      )}

      <McpServerFormModal
        opened={showForm}
        onClose={() => { setShowForm(false); setEditServer(null); }}
        onSave={fetchData}
        editServer={editServer}
      />
    </Box>
  );
}
