import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceInfo, ConversationInfo } from '../types/workspace';
import { useWorkspaceStore } from '../store/workspaceStore';

// ==================== Workspace Queries & Mutations ====================

// 1. 获取工作区列表
export function useWorkspacesQuery() {
  return useQuery<WorkspaceInfo[]>({
    queryKey: ['workspaces'],
    queryFn: () => invoke<WorkspaceInfo[]>('list_workspaces'),
    staleTime: 10 * 60 * 1000, // 工作空间变化不频繁，可以缓存 10 分钟
  });
}

// 2. 创建工作区
export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => invoke<WorkspaceInfo>('create_workspace', { name }),
    onSuccess: (newWs) => {
      // 失效工作空间列表，自动重新拉取
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      // 自动设置新建的工作区为当前激活状态
      useWorkspaceStore.getState().setActiveWorkspace(newWs.id);
    },
  });
}

// 3. 删除工作区
export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke('delete_workspace', { id }),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      
      const { activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore.getState();
      // 如果删除的是当前激活的工作区，清空激活状态
      if (activeWorkspaceId === deletedId) {
        setActiveWorkspace(null);
      }
    },
  });
}

// ==================== Conversation Queries & Mutations ====================

// 4. 获取指定工作区下的会话列表
export function useConversationsQuery(workspaceId: string | null) {
  return useQuery<ConversationInfo[]>({
    queryKey: ['conversations', workspaceId],
    queryFn: () => invoke<ConversationInfo[]>('list_conversations', { workspaceId }),
    enabled: !!workspaceId, // 只有在有激活工作区时才发起请求
    staleTime: 2 * 60 * 1000, // 会话列表可缓存 2 分钟
  });
}

// 5. 创建新会话
export function useCreateConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, title = '' }: { workspaceId: string; title?: string }) =>
      invoke<ConversationInfo>('create_conversation', { workspaceId, title }),
    onSuccess: (newConv, variables) => {
      // 刷新该工作区下的会话缓存
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.workspaceId] });
      // 激活新创建的会话
      useWorkspaceStore.getState().setActiveConversation(newConv.id);
    },
  });
}

// 6. 删除会话
export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, convId }: { workspaceId: string; convId: string }) =>
      invoke('delete_conversation', { workspaceId, convId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.workspaceId] });
      
      const { activeConversationId, setActiveConversation } = useWorkspaceStore.getState();
      // 如果删除的是当前激活的会话，清空激活状态
      if (activeConversationId === variables.convId) {
        setActiveConversation(null);
      }
    },
  });
}

// 7. 更新会话标题
export function useUpdateConversationTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, convId, title }: { workspaceId: string; convId: string; title: string }) =>
      invoke('update_conversation_title', { workspaceId, convId, title }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.workspaceId] });
    },
  });
}
