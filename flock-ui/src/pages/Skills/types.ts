import type { McpServerInfo, SkillInfo } from '@/types/protocol';

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

export type { McpServerInfo, SkillInfo };
