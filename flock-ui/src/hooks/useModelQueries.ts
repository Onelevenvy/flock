import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { ModelProvider, Model } from './useAvailableModels';

// Fetch and cache the list of model providers
export function useProvidersQuery() {
  return useQuery<ModelProvider[]>({
    queryKey: ['model_providers'],
    queryFn: () => invoke<ModelProvider[]>('list_providers'),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });
}

// Fetch and cache models for a given provider
export function useModelsQuery(providerId?: string) {
  return useQuery<Model[]>({
    queryKey: ['models', providerId],
    queryFn: () => invoke<Model[]>('list_models', { providerId }),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });
}
