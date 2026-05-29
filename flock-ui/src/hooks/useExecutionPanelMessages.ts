import { useMemo, useEffect } from 'react';
import { ChatMessage } from '../types/protocol';
import { ExecutionMessage, InterruptData, HumanAction } from '../pages/Workflow/components/ExecutionPanel/types';

interface UseExecutionPanelMessagesProps {
  messages: ExecutionMessage[];
  status: 'idle' | 'running' | 'done' | 'error';
  isInterrupted: boolean;
  activeInterrupt: InterruptData | null;
  handleResume: (choice: string, feedback?: string) => void;
}

export function useExecutionPanelMessages({
  messages,
  status,
  isInterrupted,
  activeInterrupt,
  handleResume,
}: UseExecutionPanelMessagesProps) {
  // 键盘数字键快速选择 action（仅无 feedback pending 时生效）
  useEffect(() => {
    if (!isInterrupted || !activeInterrupt?.actions) return;
    const actions = activeInterrupt.actions as HumanAction[];
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const idx = parseInt(e.key) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < actions.length) {
        const act = actions[idx];
        if (!act.enable_feedback) {
          e.preventDefault();
          handleResume(act.key);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isInterrupted, activeInterrupt, handleResume]);

  // 1. 把 raw messages 转换成 ChatPanel 可识别的 ChatMessage[]
  //    遇到 type==='interrupt' 时，在 chatMessages 里记录一个带 interruptData 的特殊消息
  const { chatMessages, interruptIndices } = useMemo(() => {
    const result: ChatMessage[] = [];
    const interruptMap: Record<number, { data: InterruptData; resolved: boolean }> = {};
    let currentAssistantMsg: ChatMessage | null = null;

    for (const msg of messages) {
      if ((msg as any).type === 'interrupt') {
        // Flush previous assistant msg
        if (currentAssistantMsg) {
          currentAssistantMsg.streaming = false;
          result.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        // Parse interrupt data from content
        let interruptData: InterruptData = {};
        try { interruptData = JSON.parse(msg.content); } catch (_) {}
        // Insert a placeholder assistant message at this index
        const msgIdx = result.length;
        result.push({
          id: `interrupt-${msg.timestamp}`,
          role: 'assistant',
          chunks: [{ kind: 'text', text: '' }],
          streaming: false,
          timestamp: msg.timestamp,
        });
        // Mark resolved if activeInterrupt is now null (already answered)
        interruptMap[msgIdx] = { data: interruptData, resolved: false };
        continue;
      }

      if (msg.type === 'user') {
        if (currentAssistantMsg) {
          result.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        // Mark all previous interrupts as resolved when user resumes
        Object.keys(interruptMap).forEach((k) => {
          const ki = Number(k);
          interruptMap[ki] = { ...interruptMap[ki], resolved: true };
        });
        result.push({
          id: `user-${msg.timestamp}`,
          role: 'user',
          chunks: [{ kind: 'text', text: msg.content }],
          streaming: false,
          timestamp: msg.timestamp,
        });
      } else if (msg.type === 'text_delta' || msg.type === 'thinking') {
        const nodeId = msg.nodeId || 'assistant';
        const displayNodeName = `**[${nodeId}]**\n`;

        if (!currentAssistantMsg || currentAssistantMsg.id !== `assistant-${nodeId}`) {
          if (currentAssistantMsg) {
            currentAssistantMsg.streaming = false;
            result.push(currentAssistantMsg);
          }
          currentAssistantMsg = {
            id: `assistant-${nodeId}`,
            role: 'assistant',
            chunks: [],
            streaming: status === 'running',
            timestamp: msg.timestamp,
          };
        }

        if (msg.type === 'thinking') {
          let lastChunk = currentAssistantMsg.chunks[currentAssistantMsg.chunks.length - 1];
          if (!lastChunk || lastChunk.kind !== 'thinking') {
            lastChunk = { kind: 'thinking', text: msg.content, collapsed: false };
            currentAssistantMsg.chunks.push(lastChunk);
          } else {
            lastChunk.text += msg.content;
          }
        } else {
          let lastChunk = currentAssistantMsg.chunks[currentAssistantMsg.chunks.length - 1];
          if (!lastChunk || lastChunk.kind !== 'text') {
            const prefix = currentAssistantMsg.chunks.length === 0 ? displayNodeName : '';
            lastChunk = { kind: 'text', text: prefix + msg.content };
            currentAssistantMsg.chunks.push(lastChunk);
          } else {
            lastChunk.text += msg.content;
          }
        }
      }
    }

    if (currentAssistantMsg) {
      if (status !== 'running') currentAssistantMsg.streaming = false;
      result.push(currentAssistantMsg);
    }

    return { chatMessages: result, interruptIndices: interruptMap };
  }, [messages, status]);

  // 当 activeInterrupt 变为 null，说明中断已解决，标记最后一个 interrupt 为 resolved
  const resolvedInterrupts = useMemo(() => {
    const copy = { ...interruptIndices };
    if (!isInterrupted) {
      Object.keys(copy).forEach((k) => {
        copy[Number(k)] = { ...copy[Number(k)], resolved: true };
      });
    }
    return copy;
  }, [interruptIndices, isInterrupted]);

  return {
    chatMessages,
    resolvedInterrupts,
  };
}
