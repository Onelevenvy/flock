import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ModelProvider {
  id: string;
  provider_name: string;
  provider_type: string;
  base_url: string | null;
  api_key: string | null;
  icon: string | null;
  description: string | null;
  is_available: boolean;
}

export interface Model {
  id: string;
  provider_id: string;
  model_name: string;
  categories: string[];
  capabilities: string[];
  is_online: boolean;
}

export interface GroupedModelOption {
  group: string;
  items: { value: string; label: string; providerName: string }[];
}

export function useAvailableModels() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provList = await invoke<ModelProvider[]>('list_providers');
      setProviders(provList);

      const allModels: Model[] = [];
      for (const p of provList) {
        try {
          const ms = await invoke<Model[]>('list_models', { providerId: p.id });
          // 仅过滤 Chat 节点且是在线可用的模型
          const filtered = ms.filter(m => m.categories.includes('chat') && m.is_online);
          allModels.push(...filtered);
        } catch (e) {
          console.warn(`Failed to load models for provider ${p.provider_name}:`, e);
        }
      }
      setModels(allModels);
    } catch (e) {
      console.error('Failed to load available models:', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 构建按服务商分组的下拉框数据
  const groupedOptions: GroupedModelOption[] = [];
  const groupedMap: Record<string, { value: string; label: string; providerName: string }[]> = {};

  models.forEach((m) => {
    const provider = providers.find((p) => p.id === m.provider_id);
    const providerName = provider?.provider_name || m.provider_id;
    // 用 provider.id 匹配图标文件（如 openai.svg, deepseek.svg, openai_compatible.svg）
    const providerIconKey = provider?.id || m.provider_id;
    if (!groupedMap[providerName]) {
      groupedMap[providerName] = [];
    }
    groupedMap[providerName].push({
      value: m.model_name,
      label: m.model_name,
      providerName: providerIconKey,
    });
  });

  Object.entries(groupedMap).forEach(([group, items]) => {
    groupedOptions.push({
      group,
      items,
    });
  });

  return {
    providers,
    models,
    loading,
    error,
    groupedOptions,
    reload: loadData,
  };
}
