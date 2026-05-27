import { invoke } from '@tauri-apps/api/core';
import { useUiStore } from './uiStore';
import { useWorkspaceStore } from './workspaceStore';
import { queryClient } from '../lib/queryClient';
import {
  ChatMessage,
  ProtocolEvent,
  ToolRequestChunk,
} from '../types/protocol';

type SetFn = (partial: any) => void;
type GetFn = () => any;

// ─── Tool Detection Helpers ───

function isCommandLineTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return (
    lower.includes('sandboxexec') ||
    lower.includes('sandbox_exec') ||
    lower.includes('bash') ||
    lower.includes('python') ||
    lower.includes('code_execution')
  );
}

function isBrowserOrDesktopTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return (
    lower.includes('browser') ||
    lower.includes('computer_use') ||
    lower.includes('computeruse')
  );
}

function isToolRequiringPreview(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return (
    isBrowserOrDesktopTool(lower) ||
    isCommandLineTool(lower)
  );
}

function isComputerUseTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return lower.includes('computer_use') || lower.includes('computeruse');
}

// ─── Find Tool Args Helper ───

function findToolArgs(
  messages: ChatMessage[],
  callId: string,
): any | null {
  for (const m of messages) {
    for (const c of m.chunks) {
      if (c.kind === 'tool_request' && c.call_id === callId) {
        return c.tool?.args || null;
      }
    }
  }
  return null;
}

function parseArgs(args: any): any {
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  return args || {};
}

// ─── Environment Opening Helpers ───

function openTerminal(content: string) {
  useUiStore.getState().openEnvironment('terminal', {
    path: '.flock/sandbox/code_result.log',
    content,
    extension: 'log',
  });
}

function openVncOrScreenshot(vncUrl: string | null, screenshotPath: string) {
  const uiStore = useUiStore.getState();
  const isCurrentlyOpen = uiStore.isPreviewOpen && uiStore.environmentMode === 'computer';

  if (vncUrl) {
    const currentPreview = uiStore.previewFile;
    if (!isCurrentlyOpen || !currentPreview || currentPreview.path !== vncUrl) {
      uiStore.openEnvironment('computer', {
        path: vncUrl,
        content: '',
        extension: 'vnc',
      });
    }
  } else {
    const currentPreview = uiStore.previewFile;
    if (!isCurrentlyOpen || !currentPreview || currentPreview.path !== screenshotPath) {
      uiStore.openEnvironment('computer', {
        path: screenshotPath,
        content: '',
        extension: 'png',
      });
    }
  }
}

async function openVncForTool(screenshotPath: string, toolName: string, output: string) {
  if (isComputerUseTool(toolName)) {
    const vncRegex = /(https:\/\/6080-[^\s)]+)/;
    const match = output.match(vncRegex);
    if (match && match[1]) {
      const uiStore = useUiStore.getState();
      const isCurrentlyOpen = uiStore.isPreviewOpen && uiStore.environmentMode === 'computer';
      const currentPreview = uiStore.previewFile;
      if (!isCurrentlyOpen || !currentPreview || currentPreview.path !== match[1]) {
        uiStore.openEnvironment('computer', {
          path: match[1],
          content: '',
          extension: 'vnc',
        });
      }
      return;
    }
  }

  try {
    const vncUrl = await invoke<string | null>('get_active_sandbox_vnc_url');
    if (vncUrl) {
      const uiStore = useUiStore.getState();
      const isCurrentlyOpen = uiStore.isPreviewOpen && uiStore.environmentMode === 'computer';
      const currentPreview = uiStore.previewFile;
      if (!isCurrentlyOpen || !currentPreview || currentPreview.path !== vncUrl) {
        uiStore.openEnvironment('computer', {
          path: vncUrl,
          content: '',
          extension: 'vnc',
        });
      }
    } else if (isComputerUseTool(toolName)) {
      openTerminal(output || '');
    } else {
      openVncOrScreenshot(null, screenshotPath);
    }
  } catch {
    if (isComputerUseTool(toolName)) {
      openTerminal(output || '');
    } else {
      openVncOrScreenshot(null, screenshotPath);
    }
  }
}

// ─── Preview Opening on Tool Running ───

function handleToolRunningPreview(
  toolName: string,
  callId: string,
  screenshotPath: string,
  get: GetFn,
) {
  if (!isToolRequiringPreview(toolName)) return;

  let isCmdLine = isCommandLineTool(toolName);

  if (!isCmdLine && isComputerUseTool(toolName)) {
    try {
      const args = parseArgs(findToolArgs(get().messages, callId));
      if (args && (args.action === 'exec' || args.action === 'EXEC')) {
        isCmdLine = true;
      }
    } catch {
      // ignore
    }
  }

  if (isCmdLine) {
    let cmdStr = '';
    const args = parseArgs(findToolArgs(get().messages, callId));
    if (args.command) cmdStr = args.command;
    else if (args.code) cmdStr = args.code;
    else if (args.script) cmdStr = args.script;

    const displayContent = cmdStr
      ? `Executing sandbox command: ${cmdStr}`
      : 'Executing sandbox command...';
    openTerminal(displayContent);
  } else {
    invoke<string | null>('get_active_sandbox_vnc_url')
      .then((vncUrl) => openVncOrScreenshot(vncUrl, screenshotPath))
      .catch(() => openVncOrScreenshot(null, screenshotPath));
  }
}

// ─── Preview Opening on Tool Result ───

function handleToolResultPreview(
  toolName: string,
  output: string,
  screenshotPath: string,
) {
  const lowerTool = toolName.toLowerCase();

  if (isBrowserOrDesktopTool(lowerTool)) {
    openVncForTool(screenshotPath, toolName, output);
  } else if (isCommandLineTool(lowerTool)) {
    openTerminal(output || '');
  }
}

// ─── Individual Event Handlers ───

function handleReady(event: Extract<ProtocolEvent, { type: 'ready' }>, set: SetFn) {
  set({ status: 'ready', capabilities: event.capabilities });
}

function handleStreamStart(event: Extract<ProtocolEvent, { type: 'stream_start' }>, set: SetFn) {
  set((s: any) => ({
    status: 'thinking',
    messages: [
      ...s.messages,
      {
        id: event.msg_id,
        role: 'assistant',
        chunks: [],
        streaming: true,
        timestamp: Date.now(),
      },
    ],
  }));
}

function handleTextDelta(event: Extract<ProtocolEvent, { type: 'text_delta' }>, set: SetFn) {
  set((s: any) => ({
    messages: s.messages.map((m: ChatMessage) => {
      if (m.id !== event.msg_id) return m;
      const chunks = [...m.chunks];
      const last = chunks[chunks.length - 1];
      if (last && last.kind === 'text') {
        chunks[chunks.length - 1] = { kind: 'text', text: last.text + event.text };
      } else {
        chunks.push({ kind: 'text', text: event.text });
      }
      return { ...m, chunks };
    }),
  }));
}

function handleThinking(event: Extract<ProtocolEvent, { type: 'thinking' }>, set: SetFn) {
  set((s: any) => ({
    messages: s.messages.map((m: ChatMessage) => {
      if (m.id !== event.msg_id) return m;
      const chunks = [...m.chunks];
      const last = chunks[chunks.length - 1];
      if (last && last.kind === 'thinking') {
        chunks[chunks.length - 1] = {
          kind: 'thinking',
          text: last.text + event.text,
          collapsed: last.collapsed,
        };
      } else {
        chunks.push({ kind: 'thinking', text: event.text, collapsed: false });
      }
      return { ...m, chunks };
    }),
  }));
}

function handleToolRequest(event: Extract<ProtocolEvent, { type: 'tool_request' }>, set: SetFn) {
  set((s: any) => ({
    messages: s.messages.map((m: ChatMessage) => {
      if (m.id !== event.msg_id) return m;
      const toolChunk: ToolRequestChunk = {
        kind: 'tool_request',
        call_id: event.call_id,
        tool: event.tool,
        status: 'pending',
      };
      return { ...m, chunks: [...m.chunks, toolChunk] };
    }),
    pendingApprovals: [
      ...s.pendingApprovals,
      { call_id: event.call_id, tool: event.tool, msg_id: event.msg_id },
    ],
  }));
}

function handleToolRunning(event: Extract<ProtocolEvent, { type: 'tool_running' }>, set: SetFn, get: GetFn, screenshotPath: string) {
  set((s: any) => {
    let updated = false;
    const newMessages = s.messages.map((m: ChatMessage) => {
      if (m.id !== event.msg_id) return m;
      const updatedChunks = m.chunks.map((c: any) => {
        if (c.kind === 'tool_request' && c.call_id === event.call_id) {
          updated = true;
          const existingArgs = c.tool?.args || {};
          const mergedArgs = event.args
            ? { ...existingArgs, ...parseArgs(event.args) }
            : existingArgs;
          return {
            ...c,
            status: 'running' as const,
            tool: { ...c.tool, args: mergedArgs },
          };
        }
        return c;
      });
      if (!updated) {
        const toolChunk: ToolRequestChunk = {
          kind: 'tool_request',
          call_id: event.call_id,
          tool: {
            name: event.tool_name,
            category: 'exec' as any,
            args: event.args || {},
            description: '',
          },
          status: 'running',
        };
        return { ...m, chunks: [...m.chunks, toolChunk] };
      }
      return { ...m, chunks: updatedChunks };
    });
    return { messages: newMessages };
  });

  setTimeout(() => {
    handleToolRunningPreview(event.tool_name, event.call_id, screenshotPath, get);
  }, 100);
}

function handleToolResult(event: Extract<ProtocolEvent, { type: 'tool_result' }>, set: SetFn, screenshotPath: string) {
  set((s: any) => {
    let updated = false;
    const newMessages = s.messages.map((m: ChatMessage) => {
      if (m.id !== event.msg_id) return m;
      const updatedChunks = m.chunks.map((c: any) => {
        if (c.kind === 'tool_request' && c.call_id === event.call_id) {
          updated = true;
          return {
            ...c,
            status: 'done' as const,
            result: event.output,
            result_status: event.status,
          };
        }
        return c;
      });
      if (!updated) {
        const toolChunk: ToolRequestChunk = {
          kind: 'tool_request',
          call_id: event.call_id,
          tool: {
            name: event.tool_name,
            category: 'exec' as any,
            args: {},
            description: '',
          },
          status: 'done',
          result: event.output,
          result_status: event.status,
        };
        return { ...m, chunks: [...m.chunks, toolChunk] };
      }
      return { ...m, chunks: updatedChunks };
    });
    return { messages: newMessages };
  });

  if (event.status === 'success') {
    useUiStore.getState().triggerFileTreeRefresh();
    setTimeout(() => {
      handleToolResultPreview(event.tool_name, event.output || '', screenshotPath);
    }, 300);
  }
}

function handleToolCancelled(event: Extract<ProtocolEvent, { type: 'tool_cancelled' }>, set: SetFn) {
  set((s: any) => ({
    messages: s.messages.map((m: ChatMessage) => ({
      ...m,
      chunks: m.chunks.map((c: any) =>
        c.kind === 'tool_request' && c.call_id === event.call_id
          ? { ...c, status: 'cancelled' as const }
          : c,
      ),
    })),
    pendingApprovals: s.pendingApprovals.filter((p: any) => p.call_id !== event.call_id),
  }));
}

function handleStreamEnd(event: Extract<ProtocolEvent, { type: 'stream_end' }>, set: SetFn) {
  set((s: any) => ({
    status: 'ready',
    messages: s.messages.map((m: ChatMessage) =>
      m.id === event.msg_id
        ? { ...m, streaming: false, usage: event.usage }
        : m,
    ),
  }));
  setTimeout(() => {
    useUiStore.getState().triggerFileTreeRefresh();
  }, 500);
}

function handleInfo(event: Extract<ProtocolEvent, { type: 'info' }>, set: SetFn) {
  if (
    event.message.startsWith('[node]') ||
    event.message.startsWith('[engine]') ||
    event.message.startsWith('[route]')
  ) {
    return;
  }
  set((s: any) => {
    const messages = [...s.messages];
    if (messages.length === 0) return {};

    let targetIndex = messages.findIndex((m: ChatMessage) => m.id === event.msg_id);
    if (targetIndex === -1) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex !== -1) {
      const m = messages[targetIndex];
      const chunks = [...m.chunks];
      chunks.push({ kind: 'info', message: event.message });
      messages[targetIndex] = { ...m, chunks };
    }
    return { messages };
  });
}

function handleError(event: Extract<ProtocolEvent, { type: 'error' }>, set: SetFn) {
  set({
    status: 'error',
    errorMessage: event.error.message,
  });
}

function handleConfigChanged(event: Extract<ProtocolEvent, { type: 'config_changed' }>, set: SetFn) {
  set({ capabilities: event.capabilities });
}

function handleTitleUpdated() {
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (activeWorkspaceId) {
    queryClient.invalidateQueries({ queryKey: ['conversations', activeWorkspaceId] });
  }
}

function handleHumanTakeover(event: Extract<ProtocolEvent, { type: 'human_takeover' }>, set: SetFn) {
  set({
    humanTakeover: {
      call_id: event.call_id,
      msg_id: event.msg_id,
      message: event.message,
      remote_url: event.remote_url,
    },
  });
  if (event.remote_url) {
    useUiStore.getState().openEnvironment('computer', {
      path: event.remote_url,
      content: '',
      extension: 'vnc',
    });
  }
}

// ─── Main Event Dispatcher ───

export function handleAgentEvent(
  event: ProtocolEvent,
  get: GetFn,
  set: SetFn,
) {
  const sessionId = useWorkspaceStore.getState().activeConversationId || 'default';
  const screenshotPath = `.flock/sandbox/screenshot_${sessionId}.png`;

  switch (event.type) {
    case 'ready':
      handleReady(event, set);
      break;
    case 'stream_start':
      handleStreamStart(event, set);
      break;
    case 'text_delta':
      handleTextDelta(event, set);
      break;
    case 'thinking':
      handleThinking(event, set);
      break;
    case 'tool_request':
      handleToolRequest(event, set);
      break;
    case 'tool_running':
      handleToolRunning(event, set, get, screenshotPath);
      break;
    case 'tool_result':
      handleToolResult(event, set, screenshotPath);
      break;
    case 'tool_cancelled':
      handleToolCancelled(event, set);
      break;
    case 'stream_end':
      handleStreamEnd(event, set);
      break;
    case 'info':
      handleInfo(event, set);
      break;
    case 'error':
      handleError(event, set);
      break;
    case 'config_changed':
      handleConfigChanged(event, set);
      break;
    case 'title_updated':
      handleTitleUpdated();
      break;
    case 'human_takeover':
      handleHumanTakeover(event, set);
      break;
    default:
      break;
  }
}

// ─── Load History ───

export async function loadAgentHistory(
  workspaceId: string,
  convId: string,
  set: SetFn,
) {
  try {
    const history = await invoke<ChatMessage[]>('load_conversation_history', {
      workspaceId,
      convId,
    });
    const formattedHistory = history.map((m) => ({
      ...m,
      streaming: false,
      timestamp: m.timestamp === 0 ? Date.now() : m.timestamp,
      chunks: m.chunks.map((c) => {
        if (c.kind === 'thinking') {
          return { ...c, collapsed: true };
        }
        return c;
      }),
    }));
    set({ messages: formattedHistory, pendingApprovals: [], playbackIndex: -1 });

    const hasScreenshots = formattedHistory.some((msg) =>
      msg.chunks?.some((chunk: any) => {
        let text = '';
        if (chunk.kind === 'text') {
          text = chunk.text || '';
        } else if (chunk.kind === 'tool_request' && chunk.result) {
          text = chunk.result || '';
        }
        return text.includes('.flock/sandbox/screenshots') || text.includes('.flock\\sandbox\\screenshots');
      }),
    );

    if (hasScreenshots) {
      const sessionId = useWorkspaceStore.getState().activeConversationId || 'default';
      useUiStore.getState().openEnvironment('computer', {
        path: `.flock/sandbox/screenshot_${sessionId}.png`,
        content: '',
        extension: 'vnc',
      });
    } else {
      useUiStore.getState().closeEnvironment();
    }
  } catch (e) {
    console.error('Failed to load history:', e);
    set({ messages: [], pendingApprovals: [], playbackIndex: -1 });
  }
}
