import { create } from 'zustand';
import { useUiStore } from './uiStore';
import { useWorkspaceStore } from './workspaceStore';
import { queryClient } from '../lib/queryClient';
import {
  AgentStatus,
  Capabilities,
  ChatMessage,
  HumanTakeoverInfo,
  PendingApproval,
  ProtocolEvent,
  ToolRequestChunk,
} from '../types/protocol';

interface AgentStore {
  // 连接状态
  status: AgentStatus;
  capabilities: Capabilities | null;
  workdir: string;
  errorMessage: string | null;

  // 聊天消息列表
  messages: ChatMessage[];

  // 待审批工具调用（队列，按顺序弹出）
  pendingApprovals: PendingApproval[];

  // 人工接管状态（类似 Coze Space 的 human-in-the-loop）
  humanTakeover: HumanTakeoverInfo | null;

  // === 历史截图回放全局索引 ===
  playbackIndex: number;

  // === Actions ===

  setStatus: (status: AgentStatus) => void;
  setWorkdir: (dir: string) => void;
  setError: (msg: string | null) => void;
  setCapabilities: (caps: Capabilities) => void;

  addUserMessage: (id: string, content: string) => void;

  /** 处理来自 Agent 的原始 ProtocolEvent */
  handleEvent: (event: ProtocolEvent) => void;

  /** 用户批准/拒绝后，从队列移除 */
  removePendingApproval: (call_id: string) => void;

  /** 清除人工接管状态（用户完成接管或取消） */
  clearHumanTakeover: () => void;

  clearMessages: () => void;
  loadHistory: (workspaceId: string, convId: string) => Promise<void>;
  setPlaybackIndex: (index: number) => void;
}

import { invoke } from '@tauri-apps/api/core';

export const useAgentStore = create<AgentStore>((set) => ({
  status: 'disconnected',
  capabilities: null,
  workdir: '',
  errorMessage: null,
  messages: [],
  pendingApprovals: [],
  humanTakeover: null,
  playbackIndex: -1,

  setStatus: (status) => set({ status }),
  setWorkdir: (dir) => set({ workdir: dir }),
  setError: (msg) => set({ errorMessage: msg }),
  setCapabilities: (caps) => set({ capabilities: caps }),
  setPlaybackIndex: (playbackIndex) => set({ playbackIndex }),

  addUserMessage: (id, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role: 'user',
          chunks: [{ kind: 'text', text: content }],
          streaming: false,
          timestamp: Date.now(),
        },
      ],
    })),

  loadHistory: async (workspaceId: string, convId: string) => {
    try {
      const history = await invoke<ChatMessage[]>('load_conversation_history', {
        workspaceId,
        convId,
      });
      // 转换后端时间戳为前端时间戳，并补充 UI 属性
      const formattedHistory = history.map(m => ({
        ...m,
        streaming: false,
        timestamp: m.timestamp === 0 ? Date.now() : m.timestamp,
        chunks: m.chunks.map(c => {
          if (c.kind === 'thinking') {
            return { ...c, collapsed: true };
          }
          return c;
        })
      }));
      set({ messages: formattedHistory, pendingApprovals: [], playbackIndex: -1 });
      
      // 检查历史记录中是否包含任何截图
      const hasScreenshots = formattedHistory.some(msg => 
        msg.chunks?.some((chunk: any) => {
          let text = '';
          if (chunk.kind === 'text') {
            text = chunk.text || '';
          } else if (chunk.kind === 'tool_request' && chunk.result) {
            text = chunk.result || '';
          }
          return text.includes('.flock/sandbox/screenshots') || text.includes('.flock\\sandbox\\screenshots');
        })
      );
      
      if (hasScreenshots) {
        // 如果历史会话中含有截图，则优雅地拉起虚拟的“VNC / 离线回放”页面，使用户能立即观看时间轴回放！
        const sessionId = useWorkspaceStore.getState().activeConversationId || 'default';
        useUiStore.getState().openEnvironment('computer', {
          path: `.flock/sandbox/screenshot_${sessionId}.png`,
          content: '',
          extension: 'vnc', // 强行将扩展名置为 vnc 以走 VncView 逻辑
        });
      } else {
        useUiStore.getState().closeEnvironment();
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      set({ messages: [], pendingApprovals: [], playbackIndex: -1 });
    }
  },

  handleEvent: (event: ProtocolEvent) => {
    const sessionId = useWorkspaceStore.getState().activeConversationId || 'default';
    const screenshotPath = `.flock/sandbox/screenshot_${sessionId}.png`;
    switch (event.type) {
      case 'ready':
        set({ status: 'ready', capabilities: event.capabilities });
        break;

      case 'stream_start':
        // 新建 assistant 消息占位
        set((s) => ({
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
        break;

      case 'text_delta':
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== event.msg_id) return m;
            const chunks = [...m.chunks];
            const last = chunks[chunks.length - 1];
            if (last && last.kind === 'text') {
              // 追加到最后一个 text chunk
              chunks[chunks.length - 1] = { kind: 'text', text: last.text + event.text };
            } else {
              chunks.push({ kind: 'text', text: event.text });
            }
            return { ...m, chunks };
          }),
        }));
        break;

      case 'thinking':
        set((s) => ({
          messages: s.messages.map((m) => {
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
        break;

      case 'tool_request':
        // 在消息里添加 tool_request chunk（pending 状态）
        set((s) => ({
          messages: s.messages.map((m) => {
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
        break;

      case 'tool_running':
        set((s) => {
          let updated = false;
          const newMessages = s.messages.map((m) => {
            if (m.id !== event.msg_id) return m;
            const updatedChunks = m.chunks.map((c) => {
              if (c.kind === 'tool_request' && c.call_id === event.call_id) {
                updated = true;
                return { ...c, status: 'running' as const };
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
                status: 'running',
              };
              return { ...m, chunks: [...m.chunks, toolChunk] };
            }
            return { ...m, chunks: updatedChunks };
          });
          return { messages: newMessages };
        });
        
        // 当工具开始运行时，如果是浏览器或电脑操作，自动打开预览区
        setTimeout(() => {
          const lowerTool = event.tool_name.toLowerCase();
          if (
            lowerTool.includes('browser') ||
            lowerTool.includes('computer_use') ||
            lowerTool.includes('computeruse') ||
            lowerTool.includes('sandboxexec') ||
            lowerTool.includes('sandbox_exec') ||
            lowerTool.includes('bash') ||
            lowerTool.includes('python') ||
            lowerTool.includes('code_execution')
          ) {
            // 判断是否是 computer_use 且 action 为 exec
            let isExec = false;
            if (lowerTool.includes('computer_use') || lowerTool.includes('computeruse')) {
              try {
                // 因为是自动批准（免确认）的，我们需要尽量从 messages 中找一次 arguments
                const currentMessages = useAgentStore.getState().messages;
                let matchedToolInput: any = null;
                for (const m of currentMessages) {
                  for (const c of m.chunks) {
                    if (c.kind === 'tool_request' && c.call_id === event.call_id) {
                      matchedToolInput = c.tool?.args;
                      break;
                    }
                  }
                  if (matchedToolInput) break;
                }
                const inputObj = typeof matchedToolInput === 'string' ? JSON.parse(matchedToolInput) : matchedToolInput;
                if (inputObj && (inputObj.action === 'exec' || inputObj.action === 'EXEC')) {
                  isExec = true;
                }
              } catch (e) {}
            }

            if (isExec) {
              // 命令行命令，将其直接输出为 log
              const currentPreview = useUiStore.getState().previewFile;
              if (!currentPreview || currentPreview.path !== '.flock/sandbox/code_result.log') {
                useUiStore.getState().openEnvironment('terminal', {
                  path: '.flock/sandbox/code_result.log',
                  content: '正在执行沙盒命令...',
                  extension: 'log',
                });
              }
            } else {
              invoke<string | null>('get_active_sandbox_vnc_url')
                .then((vncUrl) => {
                  if (vncUrl) {
                    const currentPreview = useUiStore.getState().previewFile;
                    if (!currentPreview || currentPreview.path !== vncUrl) {
                      useUiStore.getState().openEnvironment('computer', {
                        path: vncUrl,
                        content: '',
                        extension: 'vnc',
                      });
                    }
                  } else {
                    const currentPreview = useUiStore.getState().previewFile;
                    if (!currentPreview || currentPreview.path !== screenshotPath) {
                      useUiStore.getState().openEnvironment('computer', {
                        path: screenshotPath,
                        content: '',
                        extension: 'png',
                      });
                    }
                  }
                })
                .catch(() => {
                  const currentPreview = useUiStore.getState().previewFile;
                  if (!currentPreview || currentPreview.path !== screenshotPath) {
                    useUiStore.getState().openEnvironment('computer', {
                      path: screenshotPath,
                      content: '',
                      extension: 'png',
                    });
                  }
                });
            }
          }
        }, 100);
        break;

      case 'tool_result':
        set((s) => {
          let updated = false;
          const newMessages = s.messages.map((m) => {
            if (m.id !== event.msg_id) return m;
            const updatedChunks = m.chunks.map((c) => {
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
          
          // 自动拉起预览
          setTimeout(() => {
            const lowerTool = event.tool_name.toLowerCase();
            if (lowerTool.includes('browser') || lowerTool.includes('computer_use') || lowerTool.includes('computeruse')) {
              const outputStr = event.output || '';
              const vncRegex = /(https:\/\/6080-[^\s)]+)/;
              const match = outputStr.match(vncRegex);
              if (match && match[1]) {
                const targetUrl = match[1];
                const currentPreview = useUiStore.getState().previewFile;
                if (!currentPreview || currentPreview.path !== targetUrl) {
                  useUiStore.getState().openEnvironment('computer', {
                    path: targetUrl,
                    content: '',
                    extension: 'vnc',
                  });
                }
              } else {
                // 如果输出中没有匹配到 VNC URL，也主动调用 API 拿 VNC URL 并设置 VNC 视图！
                invoke<string | null>('get_active_sandbox_vnc_url')
                  .then((vncUrl) => {
                    if (vncUrl) {
                      const currentPreview = useUiStore.getState().previewFile;
                      if (!currentPreview || currentPreview.path !== vncUrl) {
                        useUiStore.getState().openEnvironment('computer', {
                          path: vncUrl,
                          content: '',
                          extension: 'vnc',
                        });
                      }
                    } else {
                      if (lowerTool.includes('computer_use') || lowerTool.includes('computeruse')) {
                        // 如果是 computer_use 且没有 VNC 链接（即 exec 动作），则展示日志输出，不报“文件不存在”错误
                        const currentPreview = useUiStore.getState().previewFile;
                        if (!currentPreview || currentPreview.path !== '.flock/sandbox/code_result.log') {
                          useUiStore.getState().openEnvironment('terminal', {
                            path: '.flock/sandbox/code_result.log',
                            content: event.output || '',
                            extension: 'log',
                          });
                        }
                      } else {
                        const currentPreview = useUiStore.getState().previewFile;
                        if (!currentPreview || currentPreview.path !== screenshotPath) {
                          useUiStore.getState().openEnvironment('computer', {
                            path: screenshotPath,
                            content: '',
                            extension: 'png',
                          });
                        }
                      }
                    }
                  })
                  .catch(() => {
                    if (lowerTool.includes('computer_use') || lowerTool.includes('computeruse')) {
                      const currentPreview = useUiStore.getState().previewFile;
                      if (!currentPreview || currentPreview.path !== '.flock/sandbox/code_result.log') {
                        useUiStore.getState().openEnvironment('terminal', {
                          path: '.flock/sandbox/code_result.log',
                          content: event.output || '',
                          extension: 'log',
                        });
                      }
                    } else {
                      const currentPreview = useUiStore.getState().previewFile;
                      if (!currentPreview || currentPreview.path !== screenshotPath) {
                        useUiStore.getState().openEnvironment('computer', {
                          path: screenshotPath,
                          content: '',
                          extension: 'png',
                        });
                      }
                    }
                  });
              }
            } else if (lowerTool.includes('code_execution') || lowerTool.includes('sandboxexec') || lowerTool.includes('sandbox_exec') || lowerTool.includes('bash') || lowerTool.includes('python')) {
              const currentPreview = useUiStore.getState().previewFile;
              if (!currentPreview || currentPreview.path !== '.flock/sandbox/code_result.log') {
                useUiStore.getState().openEnvironment('terminal', {
                  path: '.flock/sandbox/code_result.log',
                  content: event.output || '',
                  extension: 'log',
                });
              }
            }
          }, 300);
        }
        break;

      case 'tool_cancelled':
        set((s) => ({
          messages: s.messages.map((m) => ({
            ...m,
            chunks: m.chunks.map((c) =>
              c.kind === 'tool_request' && c.call_id === event.call_id
                ? { ...c, status: 'cancelled' as const }
                : c
            ),
          })),
          pendingApprovals: s.pendingApprovals.filter((p) => p.call_id !== event.call_id),
        }));
        break;

      case 'stream_end':
        set((s) => ({
          status: 'ready',
          messages: s.messages.map((m) =>
            m.id === event.msg_id
              ? { ...m, streaming: false, usage: event.usage }
              : m
          ),
        }));
        // 一轮对话结束（正常结束或被中断），仅刷新文件树，保留预览区以供用户手动操作和查看
        setTimeout(() => {
          useUiStore.getState().triggerFileTreeRefresh();
        }, 500);
        break;

      case 'info':
        if (
          event.message.startsWith('[node]') ||
          event.message.startsWith('[engine]') ||
          event.message.startsWith('[route]')
        ) {
          break;
        }
        set((s) => {
          const messages = [...s.messages];
          if (messages.length === 0) return {};
          
          let targetIndex = messages.findIndex((m) => m.id === event.msg_id);
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
        break;

      case 'error':
        set({
          status: 'error',
          errorMessage: event.error.message,
        });
        // 报错时也不自动去掉浏览器画面，保留最后一刻的状态
        break;

      case 'config_changed':
        set({ capabilities: event.capabilities });
        break;

      case 'title_updated': {
        const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        if (activeWorkspaceId) {
          queryClient.invalidateQueries({ queryKey: ['conversations', activeWorkspaceId] });
        }
        break;
      }

      case 'human_takeover':
        // 前端收到人工接管通知：显示横幅，自动切换到 VNC tab（如果有远程 URL）
        set({ humanTakeover: {
          call_id: event.call_id,
          msg_id: event.msg_id,
          message: event.message,
          remote_url: event.remote_url,
        }});
        // 如果有远程 URL，自动切换预览面板到 VNC 控制模式
        if (event.remote_url) {
          useUiStore.getState().openEnvironment('computer', {
            path: event.remote_url,
            content: '',
            extension: 'vnc',
          });
        }
        break;

      default:
        break;
    }
  },

  removePendingApproval: (call_id) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((p) => p.call_id !== call_id),
    })),

  clearHumanTakeover: () => set({ humanTakeover: null }),

  clearMessages: () => {
    useUiStore.getState().closeEnvironment();
    set({ messages: [], pendingApprovals: [] });
  },
}));
