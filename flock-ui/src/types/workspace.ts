export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  created_at: number;
}

export interface ConversationInfo {
  id: string;
  workspace_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  assistant_id?: string | null;
}
