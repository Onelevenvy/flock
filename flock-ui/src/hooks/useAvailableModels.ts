import { useProvidersQuery } from './useModelQueries';
import { useQueries } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { parseMultiLang } from '../utils/i18n';

export interface ModelProvider {
  id: string;
  provider_name: any;
  provider_type: string;
  base_url: string | null;
  api_key: string | null;
  icon: string | null;
  description: any;
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
  // 1. 获取所有 Providers 并缓存
  const { data: providers = [], isLoading: loadingProviders, error: errorProviders, refetch: refetchProviders } = useProvidersQuery();

  // 2. 针对每个 Provider 并行且带缓存地加载 Models
  const modelsQueries = useQueries({
    queries: providers.map((p) => ({
      queryKey: ['models', p.id],
      queryFn: () => invoke<Model[]>('list_models', { providerId: p.id }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const loadingModels = modelsQueries.some((q) => q.isLoading);
  const hasError = errorProviders || modelsQueries.some((q) => q.isError);

  // 3. 合并所有加载出来的 Chat 模型
  const allModels: Model[] = [];
  modelsQueries.forEach((query) => {
    if (query.data) {
      const filtered = query.data.filter(
        (m) => m.categories.includes('chat') && m.is_online
      );
      allModels.push(...filtered);
    }
  });

  // 4. 重试/重新加载数据
  const reloadData = async () => {
    await refetchProviders();
    modelsQueries.forEach((query) => {
      query.refetch();
    });
  };

  // 5. 构建按服务商分组的下拉框数据
  const groupedOptions: GroupedModelOption[] = [];
  const groupedMap: Record<string, { value: string; label: string; providerName: string }[]> = {};

  allModels.forEach((m) => {
    const provider = providers.find((p) => p.id === m.provider_id);
    const providerName = provider ? parseMultiLang(provider.provider_name) : m.provider_id;
    const providerIconKey = provider?.icon ?? '';
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
    models: allModels,
    loading: loadingProviders || loadingModels,
    error: hasError ? 'Failed to load models or providers' : null,
    groupedOptions,
    reload: reloadData,
  };
}
