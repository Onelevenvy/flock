import { useState, useEffect } from 'react';
import { Group, Text, Tooltip, Loader } from '@mantine/core';
import { IconCube, IconCheck } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useWorkspacesQuery } from '@/hooks/useWorkspaces';
import { reconnectCurrentAgent } from '@/lib/agentConnection';
import { ModelSelect } from './ModelSelect';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { parseMultiLang } from '@/utils/i18n';

interface ActiveModel {
  provider_id: string;
  model_name: string;
}

export function ActiveModelPicker() {
  const { t } = useTranslation();
  const { providers, models, loading: modelsLoading, reload: reloadModels } = useAvailableModels();
  const [activeModel, setActiveModelState] = useState<ActiveModel | null>(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { activeConversationId } = useWorkspaceStore();

  const loadActiveModel = async () => {
    setLoadingActive(true);
    try {
      const active = await invoke<ActiveModel | null>('get_active_model', {
        sessionId: activeConversationId || null,
      });
      let resolvedActive = active;
      if (!resolvedActive) {
        try {
          const defaultCfg = await invoke<{ provider: string; model: string | null } | null>('get_app_config', { key: 'default' });
          if (defaultCfg && defaultCfg.provider && defaultCfg.model) {
            resolvedActive = {
              provider_id: defaultCfg.provider,
              model_name: defaultCfg.model,
            };
          }
        } catch (e) {
          console.error('Failed to resolve default model config:', e);
        }
      }
      setActiveModelState(resolvedActive);
    } catch (e) {
      console.error('Failed to load active model:', e);
    } finally {
      setLoadingActive(false);
    }
  };

  useEffect(() => {
    loadActiveModel();
  }, [activeConversationId]);

  const loadData = async () => {
    await Promise.all([
      loadActiveModel(),
      reloadModels()
    ]);
  };

  const loading = modelsLoading || loadingActive;

  const currentModelId = activeModel
    ? `${activeModel.provider_id}:${activeModel.model_name}`
    : undefined;

  const handleChange = async (value: string | null) => {
    if (!value) return;
    const [providerId, ...modelParts] = value.split(':');
    const modelName = modelParts.join(':');
    try {
      await invoke('set_active_model', {
        providerId,
        modelName,
        sessionId: activeConversationId || null,
      });
      setActiveModelState({ provider_id: providerId, model_name: modelName });
      await reconnectCurrentAgent(workspaces);
    } catch (e) {
      console.error('Failed to set active model:', e);
    }
  };

  // Build select data grouped by provider
  const groupedModels: Record<string, { value: string; label: string; providerName: string }[]> = {};
  models.forEach((m) => {
    const provider = providers.find((p) => p.id === m.provider_id);
    const groupName = provider ? parseMultiLang(provider.provider_name) : m.provider_id;
    const providerIconKey = provider?.icon ?? '';
    if (!groupedModels[groupName]) groupedModels[groupName] = [];
    groupedModels[groupName].push({
      value: `${m.provider_id}:${m.model_name}`,
      label: m.model_name,
      providerName: providerIconKey,
    });
  });

  const selectData = Object.entries(groupedModels).map(([group, items]) => ({
    group,
    items,
  }));

  if (selectData.length === 0) {
    return (
      <Tooltip label={t('common.model.configureFirst')} withArrow>
        <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => loadData()}>
          <IconCube size={14} color="var(--flock-text-dim)" />
          <Text size="xs" c="dimmed">{t('common.model.notConfigured')}</Text>
        </Group>
      </Tooltip>
    );
  }

  return (
    <ModelSelect
      data={selectData}
      value={currentModelId}
      onChange={handleChange}
      onDropdownOpen={loadData}
      size="xs"
      w={180}
      placeholder={t('common.model.selectModel')}
      searchable
      rightSection={
        loading ? (
          <Loader size={14} />
        ) : currentModelId ? (
          <IconCheck size={12} color="var(--mantine-color-teal-5)" />
        ) : undefined
      }
      styles={{
        input: {
          background: 'var(--flock-bg-surface)',
          border: '1px solid var(--flock-border-dim)',
          color: 'var(--flock-text-primary)',
          fontSize: 11,
          height: 28,
          minHeight: 28,
        },
        dropdown: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
        },
        option: {
          fontSize: 12,
          color: 'var(--flock-text-primary)',
        },
      }}
    />
  );
}