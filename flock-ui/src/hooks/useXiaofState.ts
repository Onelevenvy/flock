import { useMemo } from 'react';
import { useAgentStore } from '@/store/agentStore';

export type XiaofMood =
  | 'sleeping'   // disconnected
  | 'waking'     // connecting
  | 'idle'       // ready, no activity
  | 'thinking'   // thinking (LLM streaming)
  | 'working'    // tool running
  | 'waiting'    // pending approval
  | 'takeover'   // human takeover
  | 'error';     // error

export interface XiaofState {
  mood: XiaofMood;
  bubbleText: string | null;
  pendingCount: number;
}

export function useXiaofState(): XiaofState {
  const status = useAgentStore((s) => s.status);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const humanTakeover = useAgentStore((s) => s.humanTakeover);

  // Detect if any tool is currently running via a fine-grained selector
  const isToolRunning = useAgentStore((s) => {
    for (const msg of s.messages) {
      for (const chunk of msg.chunks) {
        if (chunk.kind === 'tool_request' && chunk.status === 'running') {
          return chunk.tool?.name ?? 'unknown';
        }
      }
    }
    return null;
  });

  const pendingCount = pendingApprovals.length;

  const mood: XiaofMood = useMemo(() => {
    if (humanTakeover) return 'takeover';
    if (pendingCount > 0) return 'waiting';
    if (status === 'error') return 'error';
    if (status === 'disconnected') return 'sleeping';
    if (status === 'connecting') return 'waking';
    if (isToolRunning) return 'working';
    if (status === 'thinking') return 'thinking';
    return 'idle';
  }, [humanTakeover, pendingCount, status, isToolRunning]);

  // Bubble text: show for a limited time then fade
  const bubbleText = useMemo((): string | null => {
    if (humanTakeover) return `🖐️ ${humanTakeover.message.slice(0, 40)}`;
    if (pendingCount > 0) {
      const toolName = pendingApprovals[0]?.tool?.name ?? 'tool';
      return `🔔 ${toolName}`;
    }
    if (isToolRunning) return `⚡ ${isToolRunning}`;
    return null;
  }, [humanTakeover, pendingCount, pendingApprovals, isToolRunning]);

  return { mood, bubbleText, pendingCount };
}

