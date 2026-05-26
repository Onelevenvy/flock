import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Text,
  SimpleGrid,
  Badge,
  Group,
  LoadingOverlay,
  ThemeIcon,
  ScrollArea,
} from '@mantine/core';
import { IconTool } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { ToolProvider, Tool } from './types';
import { getProviderDescription, getProviderName } from './helpers';
import { ToolsIcon } from '../../components/Common/Icons';
import { ProviderDetailPanel } from './components/ProviderDetailPanel';

export function ToolsTab() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ToolProvider[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ToolProvider | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      invoke<ToolProvider[]>('list_tool_providers'),
      invoke<Tool[]>('list_tools'),
    ])
      .then(([p, t]) => { setProviders(p); setTools(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (selectedProvider) {
      const fresh = providers.find((p) => p.id === selectedProvider.id);
      if (fresh && fresh !== selectedProvider) setSelectedProvider(fresh);
    }
  }, [providers, selectedProvider]);

  const toolCountByProvider = (providerId: string) => tools.filter((t) => t.provider_id === providerId).length;
  const selectedTools = selectedProvider ? tools.filter((t) => t.provider_id === selectedProvider.id) : [];

  const filteredProviders = providers.filter((p) => !p.id.startsWith('mcp:'));

  return (
    <Box
      style={{ height: '100%', display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' }}
      onClick={() => setSelectedProvider(null)}
    >
      <LoadingOverlay visible={loading} />
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        {filteredProviders.length === 0 && !loading ? (
          <Box py={48} style={{ textAlign: 'center' }}>
            <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="md">
              <IconTool size={24} />
            </ThemeIcon>
            <Text c="dimmed" size="sm">
              {t('skills.tools.noProviders')}
            </Text>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {filteredProviders.map((provider) => (
              <Box
                key={provider.id}
                p="md"
                onClick={(e) => { e.stopPropagation(); setSelectedProvider(provider); }}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${selectedProvider?.id === provider.id ? 'var(--flock-accent)' : 'var(--flock-border-subtle)'}`,
                  background: selectedProvider?.id === provider.id ? 'var(--flock-accent-soft)' : 'var(--flock-bg-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
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
                    <ToolsIcon name={provider.icon || provider.id} size={20} />
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate style={{ color: 'var(--flock-text-bright)' }}>{getProviderName(provider)}</Text>
                  </Box>
                </Group>
                <Box mb="sm" style={{ minHeight: 36 }}>
                  <Text size="xs" c="dimmed" lineClamp={2}>{getProviderDescription(provider)}</Text>
                </Box>
                <Group justify="space-between">
                  <Group gap={6}>
                    <Badge size="xs" variant="light" color="blue" radius="sm">
                      {provider.id.startsWith('builtin') ? 'builtin' : 'provider'}
                    </Badge>
                    {provider.credentials_schema && !provider.is_available && (
                      <Badge size="xs" variant="light" color="orange" radius="sm">
                        {t('skills.tools.needAuthBadge')}
                      </Badge>
                    )}
                    {provider.is_available && (
                      <Badge size="xs" variant="light" color="green" radius="sm">
                        {t('skills.tools.available')}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t('skills.tools.toolsCount', { count: toolCountByProvider(provider.id) })}
                  </Text>
                </Group>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>
      {selectedProvider && (
        <ProviderDetailPanel
          provider={selectedProvider}
          tools={selectedTools}
          onClose={() => setSelectedProvider(null)}
          onCredentialsSaved={fetchData}
        />
      )}
    </Box>
  );
}
