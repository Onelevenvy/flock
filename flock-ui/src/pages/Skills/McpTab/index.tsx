import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  SimpleGrid,
  Badge,
  Group,
  LoadingOverlay,
  ThemeIcon,
  Button,
  ScrollArea,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconServer,
  IconAlertCircle,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { McpServerInfo, Tool } from '../types';
import { ToolsIcon } from '../../../components/Common/Icons';
import { McpServerDetailPanel } from './components/McpServerDetailPanel';
import { McpServerFormModal } from './components/McpServerFormModal';

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
    <Box
      style={{ height: '100%', display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' }}
      onClick={() => setSelectedServer(null)}
    >
      <LoadingOverlay visible={loading} />

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Group justify="flex-end" mb="md" onClick={(e) => e.stopPropagation()}>
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
                onClick={(e) => { e.stopPropagation(); setSelectedServer(server); }}
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
