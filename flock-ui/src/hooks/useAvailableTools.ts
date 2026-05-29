import { useToolProvidersQuery, useToolsQuery } from './useToolQueries';
import i18n from '../i18n';

export interface I18nString {
  zh: string;
  en: string;
}

export interface ToolProvider {
  id: string;
  provider_name: I18nString;
  description: I18nString | null;
  icon: string | null;
  credentials: string | null;
  credentials_schema: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  tools_i18n?: Record<string, any> | null;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  input_schema: string;
  provider_id: string;
  is_deferred: boolean;
}

export interface GroupedToolOption {
  group: string;
  items: { value: string; label: string }[];
}

export function useAvailableTools() {
  const { data: providers = [], isLoading: loadingProviders, error: errorProviders, refetch: refetchProviders } = useToolProvidersQuery();
  const { data: tools = [], isLoading: loadingTools, error: errorTools, refetch: refetchTools } = useToolsQuery();

  const loading = loadingProviders || loadingTools;
  const hasError = errorProviders || errorTools;

  const reloadData = async () => {
    await Promise.all([
      refetchProviders(),
      refetchTools()
    ]);
  };

  // 构建按服务商/插件分组的下拉框数据
  const groupedOptions: GroupedToolOption[] = [];
  const groupedMap: Record<string, { value: string; label: string }[]> = {};

  tools.forEach((t) => {
    const provider = providers.find((p) => p.id === t.provider_id);
    let providerName = t.provider_id;
    if (provider) {
      const currentLang = (i18n.language || 'zh').split('-')[0];
      const nameObj = provider.provider_name;
      providerName = nameObj[currentLang as 'zh' | 'en'] || nameObj.en || nameObj.zh || t.provider_id;
    }
    if (!groupedMap[providerName]) {
      groupedMap[providerName] = [];
    }
    groupedMap[providerName].push({
      value: t.name, // 绑定的时候使用 name (因为 LLM 绑定工具是用 name 标识的，如 "web_search")
      label: `${t.name} - ${t.description.split('\n')[0] || ''}`,
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
    tools,
    loading,
    error: hasError ? 'Failed to load available tools' : null,
    groupedOptions,
    reload: reloadData,
  };
}
