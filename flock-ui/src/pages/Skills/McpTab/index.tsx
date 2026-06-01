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
import type { McpServerInfo, Tool } from '@/pages/Skills/types';
import { ToolsIcon } from '@/components/Common/Icons';
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
                  borderRadius: 18,
                  border: `1px solid ${selectedServer?.id === server.id ? 'var(--flock-accent)' : 'var(--flock-border-subtle)'}`,
                  background: selectedServer?.id === server.id ? 'var(--flock-accent-soft)' : 'var(--flock-bg-raised)',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
                  opacity: server.enabled ? 1 : 0.6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--flock-accent)';
                  e.currentTarget.style.boxShadow = '0 14px 36px rgba(21, 90, 239, 0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = selectedServer?.id === server.id ? 'var(--flock-accent)' : 'var(--flock-border-subtle)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.05)';
                }}
              >
                <Group gap="sm" mb="sm">
                  <Box
                    style={{
                      width: 46,
                      height: 46,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 14,
                      background: 'var(--flock-accent-soft)',
                      color: 'var(--flock-accent)',
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
