import { useState, useEffect } from 'react';
import { Select, Group, Text, Tooltip, Loader } from '@mantine/core';
import { IconCube, IconCheck } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspacesQuery } from '../../hooks/useWorkspaces';
import { reconnectCurrentAgent } from '../../lib/agentConnection';

interface ModelProvider {
  id: string;
  provider_name: string;
  provider_type: string;
  base_url: string | null;
  api_key: string | null;
  icon: string | null;
  description: string | null;
  is_available: boolean;
}

interface Model {
  id: string;
  provider_id: string;
  model_name: string;
  categories: string[];
  capabilities: string[];
  is_online: boolean;
}

interface ActiveModel {
  provider_id: string;
  model_name: string;
}

export function ModelSelector() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [activeModel, setActiveModelState] = useState<ActiveModel | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: workspaces = [] } = useWorkspacesQuery();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [provList, active] = await Promise.all([
        invoke<ModelProvider[]>('list_providers'),
        invoke<ActiveModel | null>('get_active_model'),
      ]);
      setProviders(provList);

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

      // Load models for all providers
      const allModels: Model[] = [];
      for (const p of provList) {
        try {
          const ms = await invoke<Model[]>('list_models', { providerId: p.id });
          // Filter: only chat models that are marked online
          const filtered = ms.filter(m => m.categories.includes('chat') && m.is_online);
          allModels.push(...filtered);
        } catch { /* ignore */ }
      }
      setModels(allModels);
    } catch (e) {
      console.error('Failed to load model data:', e);
    } finally {
      setLoading(false);
    }
  };

  const currentModelId = activeModel
    ? `${activeModel.provider_id}:${activeModel.model_name}`
    : undefined;

  const handleChange = async (value: string | null) => {
    if (!value) return;
    const [providerId, ...modelParts] = value.split(':');
    const modelName = modelParts.join(':');
    try {
      await invoke('set_active_model', { providerId, modelName });
      setActiveModelState({ provider_id: providerId, model_name: modelName });
      await reconnectCurrentAgent(workspaces);
    } catch (e) {
      console.error('Failed to set active model:', e);
    }
  };

  // Build select data grouped by provider
  const groupedModels: Record<string, { value: string; label: string }[]> = {};
  models.forEach((m) => {
    const groupName = providers.find((p) => p.id === m.provider_id)?.provider_name || m.provider_id;
    if (!groupedModels[groupName]) groupedModels[groupName] = [];
    groupedModels[groupName].push({
      value: `${m.provider_id}:${m.model_name}`,
      label: m.model_name,
    });
  });

  const selectData = Object.entries(groupedModels).map(([group, items]) => ({
    group,
    items,
  }));

  const placeholderLabel = "选择模型";

  if (selectData.length === 0) {
    return (
      <Tooltip label="请在设置中配置 API Key 并启用模型" withArrow>
        <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => loadData()}>
          <IconCube size={14} color="var(--flock-text-dim)" />
          <Text size="xs" c="dimmed">未配置模型</Text>
        </Group>
      </Tooltip>
    );
  }

  return (
    <Select
      data={selectData}
      value={currentModelId}
      onChange={handleChange}
      onDropdownOpen={loadData}
      size="xs"
      w={180}
      placeholder={placeholderLabel}
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
