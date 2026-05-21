import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  Stack,
  Loader,
  Card,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconCube,
  IconSparkles,
  IconHelpCircle,
  IconCheck,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import ProviderSettings from './ProviderSettings';
import CustomModelSettings from './CustomModelSettings';
import { reconnectCurrentAgent } from '../../../lib/agentConnection';
import { useWorkspacesQuery } from '../../../hooks/useWorkspaces';
import { ModelSelect } from '../../Common/ModelSelect';

import { ModelProvider, ModelItem, DefaultConfig, SummaryModelConfig } from './types';
import { ProviderCard } from './components/ProviderCard';

export default function ModelProviderPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [modelsMap, setModelsMap] = useState<Record<string, ModelItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [addingCustomModel, setAddingCustomModel] = useState<ModelProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [defaultCfg, setDefaultCfg] = useState<DefaultConfig | null>(null);
  const [summaryCfg, setSummaryCfg] = useState<SummaryModelConfig | null>(null);
  const { data: workspaces = [] } = useWorkspacesQuery();

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
      const msg = await invoke<string>('activate_provider', { providerId });
      setTestResult({ id: providerId, ok: true, msg });
      setConnectedProviders(prev => {
        const next = new Set(prev);
        next.add(providerId);
        return next;
      });
      loadData();
    } catch (e) {
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

  const handleDeleteModel = async (modelId: string, providerId: string) => {
    try {
      await invoke('delete_model', { id: modelId });
      setModelsMap((prev) => ({
        ...prev,
        [providerId]: prev[providerId].filter((m) => m.id !== modelId),
      }));
      notifications.show({
        title: t('common.success', 'Success'),
        message: 'Model removed successfully',
        color: 'teal',
      });
    } catch (e) {
      console.error('Failed to delete model:', e);
      notifications.show({
        title: t('common.error', 'Error'),
        message: String(e),
        color: 'red',
      });
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

      await invoke('set_active_model', { providerId, modelName });
      await reconnectCurrentAgent(workspaces);

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

  const onlineModels = Object.entries(modelsMap).flatMap(([pid, models]) => {
    const providerName = providers.find((p) => p.id === pid)?.provider_name || pid;
    return models
      .filter((m) => m.is_online)
      .map((m) => ({
        value: `${pid}:${m.model_name}`,
        label: m.model_name,
        providerName,
      }));
  });

  const summaryModels = [
    { value: 'follow', label: t('settings.model.followDefault'), providerName: '' },
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
        <Loader size="md" color="blue" />
      </Box>
    );
  }

  return (
    <Stack gap="xl" p={12}>
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
            <ThemeIcon variant="light" color="blue" size="md" radius="md">
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

          <ModelSelect
            placeholder={onlineModels.length === 0 ? t('settings.model.noModelsEnabledPlaceholder') : t('settings.model.defaultModelPlaceholder')}
            data={onlineModels}
            value={selectedDefaultValue}
            onChange={handleDefaultModelChange}
            disabled={onlineModels.length === 0}
            size="xs"
            w={260}
            searchable
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                color: 'var(--flock-text-primary)',
                height: 32,
              },
              dropdown: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
              option: {
                color: 'var(--flock-text-primary)',
              },
            }}
          />
        </Group>
      </Card>

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

          <ModelSelect
            placeholder={t('settings.model.followDefaultPlaceholder')}
            data={summaryModels}
            value={selectedSummaryValue}
            onChange={handleSummaryModelChange}
            disabled={onlineModels.length === 0}
            size="xs"
            w={260}
            searchable
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
                color: 'var(--flock-text-primary)',
                height: 32,
              },
              dropdown: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
              option: {
                color: 'var(--flock-text-primary)',
              },
            }}
          />
        </Group>
      </Card>

      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          models={modelsMap[provider.id] || []}
          isExpanded={expanded[provider.id] || false}
          toggleExpand={toggleExpand}
          connectedProviders={connectedProviders}
          testingProvider={testingProvider}
          testResult={testResult}
          handleTestConnection={handleTestConnection}
          setEditingProvider={setEditingProvider}
          setAddingCustomModel={setAddingCustomModel}
          setExpanded={setExpanded}
          handleDeleteModel={handleDeleteModel}
          handleToggleOnline={handleToggleOnline}
          t={t}
        />
      ))}

      {editingProvider && (
        <ProviderSettings
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={loadData}
        />
      )}

      {addingCustomModel && (
        <CustomModelSettings
          provider={addingCustomModel}
          onClose={() => setAddingCustomModel(null)}
          onSaved={loadData}
        />
      )}
    </Stack>
  );
}
