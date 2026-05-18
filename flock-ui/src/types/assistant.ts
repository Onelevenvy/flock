export interface Assistant {
  id: string;
  name: string;
  icon: string;
  description: string;
  model: string;
  system_prompt: string;
  tools: string[];
  skills: string[];
  is_builtin: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertAssistant {
  id?: string;
  name: string;
  icon: string;
  description: string;
  model: string;
  system_prompt: string;
  tools: string[];
  skills: string[];
  is_builtin: boolean;
  sort_order: number;
}
