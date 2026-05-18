import { useEffect, useState, useCallback } from 'react';
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
  Loader,
  Card,
  Select,
  ThemeIcon,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconSettings,
  IconCheck,
  IconX,
  IconPlug,
  IconCube,
  IconSparkles,
  IconHelpCircle,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import ProviderSettings from './ProviderSettings';
import { ModelProviderIconLong, ModelIcon } from '../../Icons';

interface ModelProvider {
  id: string;
  provider_name: string;
  provider_type: string;
  base_url: string | null;
  api_key: string | null;
  test_model: string | null;
  icon: string | null;
  description: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface ModelItem {
  id: string;
  provider_id: string;
  model_name: string;
  categories: string[];
  capabilities: string[];
  is_online: boolean;
  meta: any;
  created_at: string;
  updated_at: string;
}



interface DefaultConfig {
  provider: string;
  model: string | null;
  max_tokens?: number;
  max_turns?: number | null;
  system_prompt?: string | null;
}

interface SummaryModelConfig {
  provider: string;
  model: string | null;
}

export default function ModelProviderPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [modelsMap, setModelsMap] = useState<Record<string, ModelItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [defaultCfg, setDefaultCfg] = useState<DefaultConfig | null>(null);
  const [summaryCfg, setSummaryCfg] = useState<SummaryModelConfig | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [list, def, summary] = await Promise.all([
        invoke<ModelProvider[]>('list_providers'),
        invoke<DefaultConfig | null>('get_app_config', { key: 'default' }),
        invoke<SummaryModelConfig | null>('get_app_config', { key: 'summary_model' }),
      ]);
      setProviders(list);
      if (def) setDefaultCfg(def);
      if (summary) setSummaryCfg(summary);

      // 初始化已连接状态（如果 is_available 为 true 且有在线模型，认为可能已连接）
      const connected = new Set<string>();
      const models: Record<string, ModelItem[]> = {};
      for (const p of list) {
        const pModels = await invoke<ModelItem[]>('list_models', { providerId: p.id });
        models[p.id] = pModels;
        if (p.is_available && pModels.some(m => m.is_online)) {
          connected.add(p.id);
        }
      }
      setModelsMap(models);
      setConnectedProviders(connected);
    } catch (e) {
      console.error('Failed to load providers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResult(null);
    try {
      // 使用 activate_provider 代替单纯的测试，确保测试通过后开启模型
      const msg = await invoke<string>('activate_provider', { providerId });
      setTestResult({ id: providerId, ok: true, msg });
      setConnectedProviders(prev => {
        const next = new Set(prev);
        next.add(providerId);
        return next;
      });
      // 重新加载数据以反映模型状态变化
      loadData();
    } catch (e: any) {
      setTestResult({ id: providerId, ok: false, msg: String(e) });
      setConnectedProviders(prev => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleToggleOnline = async (modelId: string, currentOnline: boolean) => {
    // Find the model and update it
    for (const [pid, models] of Object.entries(modelsMap)) {
      const model = models.find((m) => m.id === modelId);
      if (model) {
        try {
          await invoke('upsert_model', {
            model: { ...model, is_online: !currentOnline },
          });
          setModelsMap((prev) => ({
            ...prev,
            [pid]: prev[pid].map((m) =>
              m.id === modelId ? { ...m, is_online: !currentOnline } : m
            ),
          }));
        } catch (e) {
          console.error('Failed to update model:', e);
        }
        break;
      }
    }
  };

  const handleDefaultModelChange = async (value: string | null) => {
    if (!value) return;
    const [providerId, ...modelParts] = value.split(':');
    const modelName = modelParts.join(':');

    try {
      const currentDefault = await invoke<DefaultConfig | null>('get_app_config', { key: 'default' }) || {
        provider: 'openai',
        model: null,
      };

      const newDefault = {
        ...currentDefault,
        provider: providerId,
        model: modelName,
      };

      await invoke('set_app_config', { key: 'default', value: newDefault });
      setDefaultCfg(newDefault);

      // Linkage: sync active_model as well
      await invoke('set_active_model', { providerId, modelName });

      notifications.show({
        title: t('settings.model.setDefaultSuccess'),
        message: t('settings.model.setDefaultSuccessMsg', { modelName }),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      console.error('Failed to set default model:', e);
      notifications.show({
        title: t('settings.model.setDefaultFailed'),
        message: t('settings.model.setDefaultFailedMsg'),
        color: 'red',
      });
    }
  };

  const handleSummaryModelChange = async (value: string | null) => {
    if (!value) return;

    let newSummary: SummaryModelConfig;
    if (value === 'follow') {
      newSummary = {
        provider: 'follow',
        model: null,
      };
    } else {
      const [providerId, ...modelParts] = value.split(':');
      const modelName = modelParts.join(':');
      newSummary = {
        provider: providerId,
        model: modelName,
      };
    }

    try {
      await invoke('set_app_config', { key: 'summary_model', value: newSummary });
      setSummaryCfg(newSummary);

      notifications.show({
        title: t('settings.model.setSummarySuccess'),
        message: value === 'follow'
          ? t('settings.model.setSummaryFollowMsg')
          : t('settings.model.setSummaryModelMsg', { modelName: newSummary.model }),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      console.error('Failed to set summary model:', e);
      notifications.show({
        title: t('settings.model.setSummaryFailed'),
        message: t('settings.model.setSummaryFailedMsg'),
        color: 'red',
      });
    }
  };

  // Compile online models for options list
  const onlineModels = Object.entries(modelsMap).flatMap(([pid, models]) => {
    const providerName = providers.find((p) => p.id === pid)?.provider_name || pid;
    return models
      .filter((m) => m.is_online)
      .map((m) => ({
        value: `${pid}:${m.model_name}`,
        label: `${m.model_name} (${providerName})`,
      }));
  });

  const summaryModels = [
    { value: 'follow', label: t('settings.model.followDefault') },
    ...onlineModels,
  ];

  const selectedDefaultValue = defaultCfg?.provider && defaultCfg?.model
    ? `${defaultCfg.provider}:${defaultCfg.model}`
    : '';

  const selectedSummaryValue = summaryCfg?.provider
    ? (summaryCfg.provider === 'follow' ? 'follow' : `${summaryCfg.provider}:${summaryCfg.model || ''}`)
    : 'follow';

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader size="md" color="indigo" />
      </Box>
    );
  }

  return (
    <Stack gap="xl" p={12}>
      {/* 全局默认系统模型设置 Card */}
      <Card
        style={{
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 16,
        }}
        padding="md"
      >
        <Group justify="space-between" align="center">
          <Group gap="sm" style={{ flex: 1 }}>
            <ThemeIcon variant="light" color="indigo" size="md" radius="md">
              <IconCube size={18} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Group gap={6} wrap="nowrap">
                <Text fw={700} size="sm">
                  {t('settings.model.defaultModelTitle')}
                </Text>
                <Tooltip
                  label={t('settings.model.defaultModelTooltip')}
                  multiline
                  w={260}
                  withArrow
                  position="top"
                >
                  <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help', display: 'inline-block', verticalAlign: 'middle' }} />
                </Tooltip>
              </Group>
            </Box>
          </Group>

          <Select
            placeholder={onlineModels.length === 0 ? t('settings.model.noModelsEnabledPlaceholder') : t('settings.model.defaultModelPlaceholder')}
            data={onlineModels}
            value={selectedDefaultValue}
            onChange={handleDefaultModelChange}
            disabled={onlineModels.length === 0}
            size="xs"
            w={260}
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                height: 32,
              },
              dropdown: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />
        </Group>
      </Card>

      {/* 对话主题总结模型设置 Card */}
      <Card
        style={{
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 16,
          marginTop: -12,
        }}
        padding="md"
      >
        <Group justify="space-between" align="center">
          <Group gap="sm" style={{ flex: 1 }}>
            <ThemeIcon variant="light" color="teal" size="md" radius="md">
              <IconSparkles size={18} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Group gap={6} wrap="nowrap">
                <Text fw={700} size="sm">
                  {t('settings.model.summaryModelTitle')}
                </Text>
                <Tooltip
                  label={t('settings.model.summaryModelTooltip')}
                  multiline
                  w={260}
                  withArrow
                  position="top"
                >
                  <IconHelpCircle size={14} color="var(--flock-text-dim)" style={{ cursor: 'help', display: 'inline-block', verticalAlign: 'middle' }} />
                </Tooltip>
              </Group>
            </Box>
          </Group>

          <Select
            placeholder={t('settings.model.followDefaultPlaceholder')}
            data={summaryModels}
            value={selectedSummaryValue}
            onChange={handleSummaryModelChange}
            disabled={onlineModels.length === 0}
            size="xs"
            w={260}
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                height: 32,
              },
              dropdown: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />
        </Group>
      </Card>

      {providers.map((provider) => {
        const models = modelsMap[provider.id] || [];
        const isExpanded = expanded[provider.id] || false;
        const hasApiKey = !!provider.api_key;
        const onlineCount = models.filter((m) => m.is_online).length;

        return (
          <Box
            key={provider.id}
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
                      minWidth: 56,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 14,
                      border: '1px solid var(--flock-border-subtle)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    }}
                  >
                    <ModelProviderIconLong name={provider.id} size={28} />
                  </Box>
                  <Box>
                    <Group gap="xs" align="center">
                      <Group gap={6} align="center">
                        <Text fw={700} size="lg" style={{ letterSpacing: '0.3px' }}>
                          {provider.provider_name}
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
                        variant="gradient"
                        gradient={hasApiKey ? { from: 'teal', to: 'indigo', deg: 105 } : { from: 'orange', to: 'red', deg: 105 }}
                        leftSection={hasApiKey ? <IconCheck size={12} /> : <IconX size={12} />}
                        style={{ textTransform: 'none' }}
                      >
                        {hasApiKey ? t('settings.model.configured') : t('settings.model.notConfigured')}
                      </Badge>
                    </Group>
                  </Box>
                </Group>

                <Group gap="sm">
                  {hasApiKey && (
                    <Tooltip label={testingProvider === provider.id ? t('settings.model.connecting') : t('settings.model.testConnection')}>
                      <ActionIcon
                        variant="light"
                        color={testResult?.id === provider.id ? (testResult.ok ? 'teal' : 'red') : 'indigo'}
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
                </Group>
                <Button
                  variant="subtle"
                  color="indigo"
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
                          <ModelIcon name={model.model_name} provider={provider.id} size={20} />
                        </Box>
                        <Box>
                          <Text size="sm" fw={600} c={model.is_online ? 'var(--flock-text-bright)' : 'dimmed'}>
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
                              <Badge size="xs" variant="outline" color="violet" radius="xs">
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
                          <Box>
                            <Switch
                              size="md"
                              checked={model.is_online}
                              disabled={!provider.is_available}
                              onChange={() => handleToggleOnline(model.id, model.is_online)}
                              color="indigo"
                              thumbIcon={
                                model.is_online ? (
                                  <IconCheck size={12} color="var(--mantine-color-indigo-6)" stroke={3} />
                                ) : (
                                  <IconX size={12} color="var(--flock-text-dim)" stroke={3} strokeWidth={3} />
                                )
                              }
                            />
                          </Box>
                        </Tooltip>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </Box>
        );
      })}

      {/* Provider Settings Sub-Modal */}
      {editingProvider && (
        <ProviderSettings
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={loadData}
        />
      )}
    </Stack>
  );
}
