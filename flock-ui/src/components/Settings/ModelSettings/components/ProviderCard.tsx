import React from 'react';
import {
  Box,
  Text,
  Group,
  Badge,
  Collapse,
  Button,
  Stack,
  ActionIcon,
  Tooltip,
  Switch,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconSettings,
  IconCheck,
  IconX,
  IconPlug,
  IconTrash,
} from '@tabler/icons-react';
import { TFunction } from 'i18next';
import { ModelProvider, ModelItem } from '@/components/Settings/ModelSettings/types';
import { ModelIcon, ProviderIcon } from '@/components/Common/Icons';
import { parseMultiLang } from '@/utils/i18n';

interface ProviderCardProps {
  provider: ModelProvider;
  models: ModelItem[];
  isExpanded: boolean;
  toggleExpand: (id: string) => void;
  connectedProviders: Set<string>;
  testingProvider: string | null;
  testResult: { id: string; ok: boolean; msg: string } | null;
  handleTestConnection: (providerId: string) => Promise<void>;
  setEditingProvider: (provider: ModelProvider | null) => void;
  setAddingCustomModel: (provider: ModelProvider | null) => void;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleDeleteModel: (modelId: string, providerId: string) => Promise<void>;
  handleToggleOnline: (modelId: string, currentOnline: boolean) => Promise<void>;
  t: TFunction;
}

export function ProviderCard({
  provider,
  models,
  isExpanded,
  toggleExpand,
  connectedProviders,
  testingProvider,
  testResult,
  handleTestConnection,
  setEditingProvider,
  setAddingCustomModel,
  setExpanded,
  handleDeleteModel,
  handleToggleOnline,
  t,
}: ProviderCardProps) {
  const isCustomProvider = provider.id === 'openai_compatible' || provider.id === 'anthropic_compatible';
  const isConfigured = !!provider.api_key || (isCustomProvider && models.length > 0);
  const onlineCount = models.filter((m) => m.is_online).length;

  return (
    <Box
      style={{
        background: 'var(--flock-bg-raised)',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--flock-border-base)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--flock-border-subtle)';
      }}
    >
      {/* Provider Header */}
      <Box style={{ padding: '24px 24px 16px' }}>
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <Box
              style={{
                background: 'var(--flock-bg-surface)',
                height: 56,
                width: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                border: '1px solid var(--flock-border-subtle)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                flexShrink: 0,
              }}
            >
              <ProviderIcon name={provider.icon || provider.id} size={32} />
            </Box>
            <Box>
              <Group gap="xs" align="center">
                <Group gap={6} align="center">
                  <Text fw={700} size="lg" style={{ letterSpacing: '0.3px' }}>
                    {parseMultiLang(provider.provider_name)}
                  </Text>
                  {connectedProviders.has(provider.id) && (
                    <Tooltip label={t('settings.model.connectionOk')}>
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--mantine-color-teal-6)',
                          boxShadow: '0 0 8px var(--mantine-color-teal-6)',
                          marginTop: 2
                        }}
                      />
                    </Tooltip>
                  )}
                </Group>
                <Badge
                  size="sm"
                  variant="light"
                  color={isConfigured ? 'teal' : 'orange'}
                  leftSection={isConfigured ? <IconCheck size={12} /> : <IconX size={12} />}
                  style={{ textTransform: 'none' }}
                >
                  {isConfigured ? t('settings.model.configured') : t('settings.model.notConfigured')}
                </Badge>
              </Group>
            </Box>
          </Group>

          <Group gap="sm">
            {!!provider.api_key && (
              <Tooltip label={testingProvider === provider.id ? t('settings.model.connecting') : t('settings.model.testConnection')}>
                <ActionIcon
                  variant="light"
                  color={testResult?.id === provider.id ? (testResult.ok ? 'teal' : 'red') : 'blue'}
                  size="lg"
                  radius="md"
                  onClick={() => handleTestConnection(provider.id)}
                  loading={testingProvider === provider.id}
                  disabled={testingProvider !== null}
                >
                  <IconPlug size={20} />
                </ActionIcon>
              </Tooltip>
            )}
            {provider.id !== 'openai_compatible' && provider.id !== 'anthropic_compatible' && (
              <Tooltip label={t('settings.model.configureParams')}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  radius="md"
                  onClick={() => setEditingProvider(provider)}
                >
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {/* Test result */}
        {testResult?.id === provider.id && (
          <Box
            mt="md"
            p="md"
            style={{
              background: testResult.ok
                ? 'rgba(20, 184, 166, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
              borderRadius: 12,
              border: `1px solid ${testResult.ok ? 'rgba(20, 184, 166, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              animation: 'fadeIn 0.3s ease-out'
            }}
          >
            <Group gap="xs">
              {testResult.ok ? <IconCheck size={16} color="var(--mantine-color-teal-6)" /> : <IconX size={16} color="var(--mantine-color-red-6)" />}
              <Text size="sm" fw={500} c={testResult.ok ? 'teal.4' : 'red.4'}>
                {testResult.msg}
              </Text>
            </Group>
          </Box>
        )}

        {/* Model count + expand toggle */}
        <Group justify="space-between" mt="xl">
          <Group gap="xs">
            <Badge variant="light" color="gray" size="md" radius="sm">
              {t('settings.model.modelsCount', { count: models.length })}
            </Badge>
            {onlineCount > 0 && (
              <Badge variant="dot" color="green" size="md" radius="sm">
                {t('settings.model.enabledCount', { count: onlineCount })}
              </Badge>
            )}
            {(provider.id === 'openai_compatible' || provider.id === 'anthropic_compatible') && (
              <Button variant="light" size="xs" color="blue" onClick={() => { setAddingCustomModel(provider); setExpanded((prev) => ({ ...prev, [provider.id]: true })); }}>
                {t('settings.model.addCustomModel', 'Add Custom Model')}
              </Button>
            )}
          </Group>
          <Button
            variant="subtle"
            color="blue"
            size="sm"
            leftSection={isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            onClick={() => toggleExpand(provider.id)}
            style={{ borderRadius: 8 }}
          >
            {isExpanded ? t('settings.model.hideModels') : t('settings.model.showModels')}
          </Button>
        </Group>
      </Box>

      {/* Models List */}
      <Collapse in={isExpanded}>
        <Box
          style={{
            padding: '0 24px 24px',
            borderTop: '1px solid var(--flock-border-subtle)',
            background: 'var(--flock-bg-surface)'
          }}
        >
          <Stack gap={10} pt="md">
            {models.map((model) => (
              <Group
                key={model.id}
                justify="space-between"
                style={{
                  padding: '12px 16px',
                  background: model.is_online
                    ? 'var(--flock-bg-hover)'
                    : 'var(--flock-bg-base)',
                  borderRadius: 12,
                  border: '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <Group gap="md">
                  <Box
                    style={{
                      background: 'var(--flock-bg-raised)',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      border: '1px solid var(--flock-border-subtle)',
                      opacity: model.is_online ? 1 : 0.6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    <ModelIcon name={model.model_name} provider={provider.icon || provider.id} size={20} />
                  </Box>
                  <Box>
                    <Text size="sm" fw={600} style={{ color: model.is_online ? 'var(--flock-text-primary)' : 'var(--flock-text-dim)' }}>
                      {model.model_name}
                    </Text>
                    <Group gap={6} mt={4}>
                      {model.categories
                        .filter((c) => c !== 'chat')
                        .map((cat) => (
                          <Badge key={cat} size="xs" variant="outline" color="blue" radius="xs">
                            {cat}
                          </Badge>
                        ))}
                      {model.capabilities.includes('vision') && (
                        <Badge size="xs" variant="outline" color="cyan" radius="xs">
                          vision
                        </Badge>
                      )}
                    </Group>
                  </Box>
                </Group>
                <Group gap="lg">
                  <Tooltip
                    label={!provider.is_available ? t('settings.model.activateProviderTooltip') : (model.is_online ? t('settings.model.disableModelTooltip') : t('settings.model.enableModelTooltip'))}
                    position="left"
                    withArrow
                    disabled={testingProvider === provider.id}
                  >
                    <Group gap="sm">
                      {(provider.id === 'openai_compatible' || provider.id === 'anthropic_compatible') && (
                        <Tooltip label={t('common.delete', 'Delete')}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => handleDeleteModel(model.id, provider.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Switch
                        size="md"
                        checked={model.is_online}
                        disabled={!provider.is_available}
                        onChange={() => handleToggleOnline(model.id, model.is_online)}
                        color="blue"
                        thumbIcon={
                          model.is_online ? (
                            <IconCheck size={12} color="var(--flock-accent)" stroke={3} />
                          ) : (
                            <IconX size={12} color="var(--flock-text-dim)" stroke={3} strokeWidth={3} />
                          )
                        }
                      />
                    </Group>
                  </Tooltip>
                </Group>
              </Group>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
