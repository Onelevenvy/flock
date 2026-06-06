export interface AssistantInputConfig {
  allow_file_upload: boolean;
  allow_image_upload: boolean;
  max_file_count: number;
  max_file_size_mb: number;
  allowed_mime_types: string[];
}

export interface Assistant {
  id: string;
  name: string;
  icon: string;
  description: string;
  model: string;
  system_prompt: string;
  tools: string[];
  disabled_tools: string[];
  skills: string[];
  is_builtin: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  input_config: string; // serialized JSON configuration string
}

export interface UpsertAssistant {
  id?: string;
  name: string;
  icon: string;
  description: string;
  model: string;
  system_prompt: string;
  tools: string[];
  disabled_tools: string[];
  skills: string[];
  is_builtin: boolean;
  sort_order: number;
  input_config?: string; // serialized JSON configuration string
}

