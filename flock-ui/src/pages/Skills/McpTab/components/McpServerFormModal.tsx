import { useState, useEffect } from 'react';
import {
  Stack,
  Button,
  Group,
  Modal,
  TextInput,
  Select,
  Checkbox,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { McpServerInfo } from '../types';

interface McpServerFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: () => void;
  editServer?: McpServerInfo | null;
}

export function McpServerFormModal({
  opened,
  onClose,
  onSave,
  editServer,
}: McpServerFormModalProps) {
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
    if (transport === 'stdio' && !command.trim()) {
      notifications.show({ title: t('common.failed'), message: t('skills.mcp.commandRequiredMsg'), color: 'red', autoClose: 3000 });
      return;
    }
    if (transport !== 'stdio' && !url.trim()) {
      notifications.show({ title: t('common.failed'), message: t('skills.mcp.urlRequiredMsg'), color: 'red', autoClose: 3000 });
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
    } catch (e) {
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
              required
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
              required
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
