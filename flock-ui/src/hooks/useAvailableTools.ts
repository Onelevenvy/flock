import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ToolProvider {
  id: string;
  provider_name: string;
  description: string | null;
  icon: string | null;
  credentials: string | null;
  credentials_schema: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
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
  const [providers, setProviders] = useState<ToolProvider[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [provList, toolList] = await Promise.all([
        invoke<ToolProvider[]>('list_tool_providers'),
        invoke<Tool[]>('list_tools'),
      ]);
      setProviders(provList);
      setTools(toolList);
    } catch (e) {
      console.error('Failed to load available tools:', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 构建按服务商/插件分组的下拉框数据
  const groupedOptions: GroupedToolOption[] = [];
  const groupedMap: Record<string, { value: string; label: string }[]> = {};

  tools.forEach((t) => {
    const providerName = providers.find((p) => p.id === t.provider_id)?.provider_name || t.provider_id;
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
    error,
    groupedOptions,
    reload: loadData,
  };
}
