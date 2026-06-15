import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconCheck } from '@tabler/icons-react';
import { reconnectCurrentAgent } from '@/lib/agentConnection';
import { useWorkspacesQuery } from '@/hooks/useWorkspaces';
import { useQueryClient } from '@tanstack/react-query';
import type { ModelProvider, ModelItem, DefaultConfig, SummaryModelConfig } from '@/components/Settings/ModelSettings/types';
import React from 'react';

export function useModelSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [modelsMap, setModelsMap] = useState<Record<string, ModelItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [addingCustomModel, setAddingCustomModel] = useState<{
    provider: ModelProvider;
    model?: ModelItem;
  } | null>(null);
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

      const connected = new Set<string>();
      const models: Record<string, ModelItem[]> = {};
      for (const p of list) {
        const pModels = await invoke<ModelItem[]>('list_models', { providerId: p.id });
        models[p.id] = pModels;
        if (p.is_available && pModels.some((m) => m.is_online)) {
          connected.add(p.id);
        }
      }
      setModelsMap(models);
      setConnectedProviders(connected);

      // Check if default model is set. If not, auto-set to first authenticated provider's first model.
      let resolvedDefault = def;
      if (!def || !def.model) {
        const firstAvailableProvider = list.find(p => p.is_available);
        if (firstAvailableProvider) {
          const providerModels = models[firstAvailableProvider.id] || [];
          const firstOnlineModel = providerModels.find(m => m.is_online);
          if (firstOnlineModel) {
            const newDefault = {
              provider: firstAvailableProvider.id,
              model: firstOnlineModel.model_name
            };
            await invoke('set_app_config', { key: 'default', value: newDefault });
            await invoke('set_active_model', { providerId: firstAvailableProvider.id, modelName: firstOnlineModel.model_name });
            resolvedDefault = newDefault;
          }
        }
      }

      if (resolvedDefault) setDefaultCfg(resolvedDefault);
      if (summary) setSummaryCfg(summary);

      // Invalidate React Query cache when settings data refreshes
      queryClient.invalidateQueries({ queryKey: ['model_providers'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    } catch (e) {
      console.error('Failed to load providers:', e);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

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
      setConnectedProviders((prev) => {
        const next = new Set(prev);
        next.add(providerId);
        return next;
      });
      loadData();
    } catch (e) {
      setTestResult({ id: providerId, ok: false, msg: String(e) });
      setConnectedProviders((prev) => {
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
              m.id === modelId ? { ...m, is_online: !currentOnline } : m,
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
        title: t('common.success'),
        message: t('settings.model.deleteSuccess', { defaultValue: 'Model removed successfully' }),
        color: 'teal',
      });
    } catch (e) {
      console.error('Failed to delete model:', e);
      notifications.show({
        title: t('common.error'),
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
      const currentDefault =
        (await invoke<DefaultConfig | null>('get_app_config', { key: 'default' })) || {
          provider: 'openai',
          model: null,
        };

      const newDefault = { ...currentDefault, provider: providerId, model: modelName };
      await invoke('set_app_config', { key: 'default', value: newDefault });
      setDefaultCfg(newDefault);
      await invoke('set_active_model', { providerId, modelName });
      await reconnectCurrentAgent(workspaces);

      notifications.show({
        title: t('settings.model.setDefaultSuccess'),
        message: t('settings.model.setDefaultSuccessMsg', { modelName }),
        color: 'teal',
        icon: React.createElement(IconCheck, { size: 18 }),
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
      newSummary = { provider: 'follow', model: null };
    } else {
      const [providerId, ...modelParts] = value.split(':');
      const modelName = modelParts.join(':');
      newSummary = { provider: providerId, model: modelName };
    }

    try {
      await invoke('set_app_config', { key: 'summary_model', value: newSummary });
      setSummaryCfg(newSummary);

      notifications.show({
        title: t('settings.model.setSummarySuccess'),
        message:
          value === 'follow'
            ? t('settings.model.setSummaryFollowMsg')
            : t('settings.model.setSummaryModelMsg', { modelName: newSummary.model }),
        color: 'teal',
        icon: React.createElement(IconCheck, { size: 18 }),
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
    const p = providers.find((prov) => prov.id === pid);
    const providerIcon = p?.icon ?? '';
    return models
      .filter((m) => m.is_online)
      .map((m) => ({
        value: `${pid}:${m.model_name}`,
        label: m.model_name,
        providerName: providerIcon,
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
    ? summaryCfg.provider === 'follow'
      ? 'follow'
      : `${summaryCfg.provider}:${summaryCfg.model || ''}`
    : 'follow';

  return {
    providers,
    modelsMap,
    expanded,
    loading,
    editingProvider,
    setEditingProvider,
    addingCustomModel,
    setAddingCustomModel,
    testingProvider,
    testResult,
    connectedProviders,
    onlineModels,
    summaryModels,
    selectedDefaultValue,
    selectedSummaryValue,
    toggleExpand,
    handleTestConnection,
    handleToggleOnline,
    handleDeleteModel,
    handleDefaultModelChange,
    handleSummaryModelChange,
    loadData,
    setExpanded,
  };
}
