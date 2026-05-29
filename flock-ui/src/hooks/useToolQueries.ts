import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { ToolProvider, Tool } from './useAvailableTools';

// Cache the list of tool providers
export function useToolProvidersQuery() {
  return useQuery<ToolProvider[]>({
    queryKey: ['tool_providers'],
    queryFn: () => invoke<ToolProvider[]>('list_tool_providers'),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });
}

// Cache the list of tools
export function useToolsQuery() {
  return useQuery<Tool[]>({
    queryKey: ['tools'],
    queryFn: () => invoke<Tool[]>('list_tools'),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });
}

// Cache the list of skills
export function useSkillsQuery() {
  return useQuery<any[]>({
    queryKey: ['skills'],
    queryFn: () => invoke<any[]>('list_skills'),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });
}

// Cache the list of MCP servers
export function useMcpServersQuery() {
  return useQuery<any[]>({
    queryKey: ['mcp_servers'],
    queryFn: () => invoke<any[]>('list_mcp_servers'),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });
}
