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
  Accordion,
  PasswordInput,
  Button,
  Divider,
  ScrollArea,
} from '@mantine/core';
import {
  IconTool,
  IconX,
  IconEye,
  IconEyeOff,
  IconChevronRight,
  IconCheck,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { ToolProvider, Tool } from './types';
import { getProviderDescription, formatLabel, parseInputSchema } from './helpers';
import { ToolsIcon } from '../../components/Icons';

function ProviderDetailPanel({
  provider,
  tools,
  onClose,
  onCredentialsSaved,
}: {
  provider: ToolProvider;
  tools: Tool[];
  onClose: () => void;
  onCredentialsSaved: () => void;
}) {
  const { t } = useTranslation();
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const credSchema: Record<string, { type?: string; description?: string }> = (() => {
    if (!provider.credentials_schema) return {};
    try {
      return JSON.parse(provider.credentials_schema);
    } catch {
      return {};
    }
  })();

  const hasCredentials = Object.keys(credSchema).length > 0;

  useEffect(() => {
    const existing: Record<string, string> = {};
    if (provider.credentials) {
      try {
        const parsed = JSON.parse(provider.credentials);
        for (const key of Object.keys(credSchema)) {
          if (parsed[key]?.value !== undefined) {
            existing[key] = parsed[key].value;
          }
        }
      } catch { /* ignore */ }
    }
    for (const key of Object.keys(credSchema)) {
      if (!(key in existing)) {
        existing[key] = '';
      }
    }
    setCredValues(existing);
  }, [provider]);

  const handleSaveCredentials = async () => {
    const payload: Record<string, { value: string; description: string }> = {};
    for (const [key, val] of Object.entries(credValues)) {
      payload[key] = {
        value: val,
        description: credSchema[key]?.description || '',
      };
    }
    setSaving(true);
    try {
      await invoke('update_tool_provider_credentials', {
        providerId: provider.id,
        credentials: JSON.stringify(payload),
      });

      notifications.show({
        id: `testing-${provider.id}`,
        title: t('skills.tools.verifyingTitle'),
        message: t('skills.tools.verifyingMsg', { name: provider.provider_name }),
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });

      try {
        const msg = await invoke<string>('test_tool_provider', { providerId: provider.id });
        notifications.update({
          id: `testing-${provider.id}`,
          title: t('skills.tools.authSuccess'),
          message: msg,
          color: 'teal',
          icon: <IconCheck size={18} />,
          loading: false,
          autoClose: 3000,
        });
      } catch (e: any) {
        notifications.update({
          id: `testing-${provider.id}`,
          title: t('skills.tools.authFailed'),
          message: String(e),
          color: 'red',
          icon: <IconX size={18} />,
          loading: false,
          autoClose: 5000,
        });
      }

      onCredentialsSaved();
    } catch (e) {
      console.error('Failed to save credentials:', e);
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
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
            <ToolsIcon name={provider.id} size={24} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }} truncate>
              {provider.provider_name}
            </Text>
            {provider.is_available ? (
              <Group gap={4}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#51cf66' }} />
                <Text size="xs" c="dimmed">
                  {t('skills.tools.available')}
                </Text>
              </Group>
            ) : provider.credentials_schema ? (
              <Badge size="xs" variant="light" color="orange">
                {t('skills.tools.needAuth')}
              </Badge>
            ) : (
              <Badge size="xs" variant="light" color="red">
                {t('skills.tools.unavailable')}
              </Badge>
            )}
          </Box>
        </Group>
        <Text size="xs" c="dimmed">{getProviderDescription(provider)}</Text>
      </Box>

      <Divider />

      {hasCredentials && (
        <Box px="md" pt="md">
          <Group gap="xs" mb="sm">
            <IconChevronRight size={14} color="var(--flock-text-dim)" />
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
              {t('skills.tools.authInfo')}
            </Text>
          </Group>
          <Stack gap="sm">
            {Object.entries(credSchema).map(([key, field]) => (
              <Box
                key={key}
                p="sm"
                style={{
                  borderRadius: 8,
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-subtle)',
                }}
              >
                <Group gap={6} mb={6}>
                  <Text size="xs" fw={500} c="var(--flock-text-secondary)">{formatLabel(key)}</Text>
                  {field.description && <Text size="xs" c="dimmed">— {field.description}</Text>}
                </Group>
                <PasswordInput
                  size="xs"
                  value={credValues[key] || ''}
                  placeholder={formatLabel(key)}
                  onChange={(e) => setCredValues((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
                  visibilityToggleIcon={({ reveal }) => reveal ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  styles={{ input: { background: 'var(--flock-bg-base)', borderColor: 'var(--flock-border-dim)' } }}
                />
              </Box>
            ))}
          </Stack>
          <Button size="xs" color="blue" fullWidth mt="sm" mb="sm" loading={saving} onClick={handleSaveCredentials}>
            {t('skills.tools.authBtn')}
          </Button>
          <Divider />
        </Box>
      )}

      <Group gap="xs" px="md" pt="sm" pb="sm">
        <IconChevronRight size={14} color="var(--flock-text-dim)" />
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
          {t('skills.tools.availableTools')}
        </Text>
      </Group>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} px="md" pb="md">
        {tools.length > 0 ? (
          <Accordion variant="separated" radius="md" chevronPosition="left">
            {tools.map((tool) => {
              const params = parseInputSchema(tool.input_schema);
              return (
                <Accordion.Item key={tool.id} value={tool.id}>
                  <Accordion.Control style={{ borderRadius: 8, background: 'var(--flock-bg-surface)' }}>
                    <Text size="sm" fw={500}>{tool.name}</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="xs" c="dimmed">{tool.description}</Text>
                      {Object.keys(params).length > 0 && (
                        <Box>
                          <Text size="xs" fw={500} mb={4}>
                            {t('skills.tools.params')}
                          </Text>
                          <Stack gap={4}>
                            {Object.entries(params).map(([paramName, param]) => (
                              <Box key={paramName} p={6} style={{ borderRadius: 6, background: 'var(--flock-bg-surface)' }}>
                                <Group justify="space-between" mb={2}>
                                  <Text size="xs" fw={500}>{formatLabel(paramName)}</Text>
                                  <Badge size="xs" variant="filled" color="blue">{param.type || 'any'}</Badge>
                                </Group>
                                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>{param.description}</Text>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        ) : (
          <Text size="xs" c="dimmed" fs="italic">
            {t('skills.tools.noAvailableTools')}
          </Text>
        )}
      </ScrollArea>
    </Box>
  );
}

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
    <Box style={{ height: '100%', display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' }}>
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
                onClick={() => setSelectedProvider(provider)}
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
                    <ToolsIcon name={provider.id} size={20} />
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate style={{ color: 'var(--flock-text-bright)' }}>{provider.provider_name}</Text>
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
