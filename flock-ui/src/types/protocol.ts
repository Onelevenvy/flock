// ============================================================
// Protocol Types — 与 flock-ipc_interface crate 一一对应
// ============================================================

// --- Events（Agent → 前端）---

export type ToolCategory = 'info' | 'edit' | 'exec' | 'mcp';
export type ToolStatus = 'success' | 'error';
export type OutputType = 'text' | 'diff' | 'image';

export interface Capabilities {
  tool_approval: boolean;
  thinking: boolean;
  effort: boolean;
  effort_levels: string[];
  modes: string[];
  current_mode: string;
  mcp: boolean;
}

export interface ToolInfo {
  name: string;
  category: ToolCategory;
  args: Record<string, unknown>;
  description: string;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

export type ProtocolEvent =
  | { type: 'ready'; version: string; session_id?: string; capabilities: Capabilities }
  | { type: 'stream_start'; msg_id: string }
  | { type: 'text_delta'; text: string; msg_id: string }
  | { type: 'thinking'; text: string; msg_id: string }
  | { type: 'tool_request'; msg_id: string; call_id: string; tool: ToolInfo }
  | { type: 'tool_running'; msg_id: string; call_id: string; tool_name: string }
  | { type: 'tool_result'; msg_id: string; call_id: string; tool_name: string; status: ToolStatus; output: string; output_type: OutputType; metadata?: unknown }
  | { type: 'tool_cancelled'; msg_id: string; call_id: string; reason: string }
  | { type: 'stream_end'; msg_id: string; usage?: Usage }
  | { type: 'error'; msg_id?: string; error: { code: string; message: string; retryable: boolean } }
  | { type: 'info'; msg_id: string; message: string }
  | { type: 'config_changed'; capabilities: Capabilities }
  | { type: 'mcp_ready'; name: string; tools: string[] }
  | { type: 'title_updated'; thread_id: string; title: string }
  | { type: 'pong' };

// ============================================================
// UI 层消息类型（渲染用）
// ============================================================

export type MessageRole = 'user' | 'assistant';

export interface TextChunk {
  kind: 'text';
  text: string;
}

export interface ThinkingChunk {
  kind: 'thinking';
  text: string;
  collapsed: boolean;
}

export interface ToolRequestChunk {
  kind: 'tool_request';
  call_id: string;
  tool: ToolInfo;
  status: 'pending' | 'approved' | 'denied' | 'running' | 'done' | 'cancelled';
  result?: string;
  result_status?: ToolStatus;
}

export type MessageChunk = TextChunk | ThinkingChunk | ToolRequestChunk;

export interface ChatMessage {
  id: string;           // msg_id（user 消息自生成，assistant 来自 stream_start）
  role: MessageRole;
  chunks: MessageChunk[];
  usage?: Usage;
  streaming: boolean;
  timestamp: number;
}

// ============================================================
// Agent 连接状态
// ============================================================

export type AgentStatus = 'disconnected' | 'connecting' | 'ready' | 'thinking' | 'error';

export type ApprovalScope = 'once' | 'always';

export interface PendingApproval {
  call_id: string;
  tool: ToolInfo;
  msg_id: string;
}

// --- MCP Server ---

export interface McpServerInfo {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'streamable-http';
  command: string | null;
  args: string | null;
  env: string | null;
  url: string | null;
  headers: string | null;
  deferred: boolean;
  is_connected: boolean;
  last_error: string | null;
  tool_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// --- Skill Info ---

export interface SkillInfo {
  name: string;
  display_name: string | null;
  description: string;
  source: string;
  user_invocable: boolean;
  execution_context: string;
  model: string | null;
  effort: string | null;
  allowed_tools: string[];
  argument_hint: string | null;
  when_to_use: string | null;
  content_length: number;
  content: string;
  skill_root: string | null;
  paths: string[];
}
