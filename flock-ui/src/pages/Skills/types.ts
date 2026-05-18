import type { McpServerInfo, SkillInfo } from '../../types/protocol';

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

export type { McpServerInfo, SkillInfo };
