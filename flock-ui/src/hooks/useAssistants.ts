import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { Assistant, UpsertAssistant } from '../types/assistant';

function parseMultiLang(fieldVal: string | undefined | null, lang: string): string {
  if (!fieldVal) return '';
  const trimmed = fieldVal.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const currentLang = (lang || 'zh').split('-')[0];
      return parsed[currentLang] || parsed['en'] || parsed['zh'] || fieldVal;
    } catch {
      return fieldVal;
    }
  }
  return fieldVal;
}

// 1. 获取助手列表的 Hook
export function useAssistantsQuery() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  return useQuery<Assistant[]>({
    queryKey: ['assistants', currentLang],
    queryFn: async () => {
      const data = await invoke<Assistant[]>('list_assistants');
      return data.map(a => ({
        ...a,
        name: parseMultiLang(a.name, currentLang),
        description: parseMultiLang(a.description, currentLang),
      }));
    },
    // 数据默认在 5 分钟内是“新鲜”的，在此期间多次使用此 Hook 只会发起一次 Rust 调用，完美解决重复渲染的开销
    staleTime: 5 * 60 * 1000,
  });
}

// 2. 创建助手的 Mutation Hook
export function useCreateAssistantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<UpsertAssistant, 'is_builtin' | 'sort_order'>) => {
      // 从 React Query 缓存中直接获取现有的助手，以计算 sort_order，无需重新调用后端
      const currentAssistants = queryClient.getQueryData<Assistant[]>(['assistants']) || [];
      const userAssistants = currentAssistants.filter(a => !a.is_builtin);
      
      const payload: UpsertAssistant = {
        ...input,
        is_builtin: false,
        sort_order: userAssistants.length,
      };
      
      return invoke<Assistant>('create_assistant', { input: payload });
    },
    onSuccess: () => {
      // 成功后，自动让 'assistants' 的查询缓存失效并重新拉取最新数据
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
  });
}

// 3. 更新助手的 Mutation Hook
export function useUpdateAssistantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertAssistant }) =>
      invoke<Assistant>('update_assistant', { id, input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
  });
}

// 4. 删除助手的 Mutation Hook
export function useDeleteAssistantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke('delete_assistant', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
  });
}
