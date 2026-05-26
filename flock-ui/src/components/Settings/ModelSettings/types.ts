export interface ModelProvider {
  id: string;
  provider_name: any;
  provider_type: string;
  base_url: string | null;
  api_key: string | null;
  test_model: string | null;
  icon: string | null;
  description: any;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModelItem {
  id: string;
  provider_id: string;
  model_name: string;
  categories: string[];
  capabilities: string[];
  is_online: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DefaultConfig {
  provider: string;
  model: string | null;
  max_tokens?: number;
  max_turns?: number | null;
  system_prompt?: string | null;
}

export interface SummaryModelConfig {
  provider: string;
  model: string | null;
}
