import { useMemo, useEffect, useRef } from 'react';
import { ExecutionMessage, WorkflowStep, InterruptData, HumanAction } from '../pages/Workflow/components/ExecutionPanel/types';
import { nodeConfig } from '../pages/Workflow/nodeConfig';
import type { Node } from 'reactflow';

interface UseExecutionPanelMessagesProps {
  messages: ExecutionMessage[];
  status: 'idle' | 'running' | 'done' | 'error';
  isInterrupted: boolean;
  activeInterrupt: InterruptData | null;
  handleResume: (choice: string, feedback?: string) => void;
  /** ReactFlow nodes，用于解析友好名称 */
  nodes: Node[];
}

/** 从 nodeId 解析友好显示名 */
function resolveNodeDisplayName(nodeId: string, nodes: Node[]): { displayName: string; nodeType: string } {
  const node = nodes.find((n) => n.id === nodeId);
  const nodeType = node?.type ?? nodeId.split('-')[0] ?? 'unknown';
  if (node?.data?.label && typeof node.data.label === 'string') {
    return { displayName: node.data.label, nodeType };
  }
  const cfg = nodeConfig[nodeType as keyof typeof nodeConfig];
  if (cfg) {
    return { displayName: cfg.display, nodeType };
  }
  return { displayName: nodeType, nodeType };
}

export function useExecutionPanelMessages({
  messages,
  status,
  isInterrupted,
  activeInterrupt,
  handleResume,
  nodes,
}: UseExecutionPanelMessagesProps) {
  /**
   * 记录用户最后一次 resume 的选择
   * key: interrupt step id (或者 'last')，value: { actionLabel, feedback }
   * 在 user 消息到来时用于回填 resolvedActionLabel
   */
  const resolvedChoiceRef = useRef<{ actionLabel: string; feedback?: string } | null>(null);
  /** 当前 activeInterrupt 的 actions（用于键盘快捷键 + label 查找） */
  const activeInterruptRef = useRef<InterruptData | null>(activeInterrupt);
  useEffect(() => {
    activeInterruptRef.current = activeInterrupt;
  }, [activeInterrupt]);

  // 包装 handleResume：调用时立即记录选择的 action label
  const wrappedHandleResume = useMemo(() => {
    return (choice: string, feedback?: string) => {
      const actions = activeInterruptRef.current?.actions ?? [];
      const act = actions.find((a: HumanAction) => a.key === choice);
      resolvedChoiceRef.current = {
        actionLabel: act?.label ?? choice,
        feedback: feedback || undefined,
      };
      handleResume(choice, feedback);
    };
  }, [handleResume]);

  // 键盘数字键快速选择 action
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
          wrappedHandleResume(act.key);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isInterrupted, activeInterrupt, wrappedHandleResume]);

  const steps = useMemo<WorkflowStep[]>(() => {
    const result: WorkflowStep[] = [];
    // nodeId -> step index in result
    const nodeStepIndex: Record<string, number> = {};
    // interrupt step indices（用于 user 消息时批量 resolve）
    const interruptIndices: number[] = [];

    for (const msg of messages) {
      // ---- interrupt 事件 ----
      if ((msg as any).type === 'interrupt') {
        let interruptData: InterruptData = {};
        try { interruptData = JSON.parse(msg.content); } catch (_) {}
        const rawNodeId = interruptData.node_id ?? msg.nodeId ?? 'human';

        // ★ 关键修复：若该 nodeId 已有 text_delta step，原地升级为 interrupt step
        const existingIdx = nodeStepIndex[rawNodeId];
        if (existingIdx !== undefined) {
          result[existingIdx] = {
            ...result[existingIdx],
            isInterrupt: true,
            interruptData,
            status: 'waiting',
          };
          interruptIndices.push(existingIdx);
        } else {
          // 没有已有 step，新建
          const { displayName, nodeType } = resolveNodeDisplayName(rawNodeId, nodes);
          const step: WorkflowStep = {
            id: `interrupt-${msg.timestamp}`,
            nodeId: rawNodeId,
            nodeType,
            displayName,
            status: 'waiting',
            outputText: '',
            thinkingText: '',
            startTs: msg.timestamp,
            isInterrupt: true,
            interruptData,
            interruptResolved: false,
          };
          interruptIndices.push(result.length);
          nodeStepIndex[rawNodeId] = result.length;
          result.push(step);
        }
        continue;
      }

      // ---- user 消息 → 将待处理 interrupt 全部标记 resolved，并回填 actionLabel ----
      if (msg.type === 'user') {
        const choice = resolvedChoiceRef.current;
        interruptIndices.forEach((idx) => {
          result[idx] = {
            ...result[idx],
            interruptResolved: true,
            status: 'done',
            resolvedActionLabel: choice?.actionLabel,
            resolvedFeedback: choice?.feedback,
          };
        });
        // user 消息不生成 step
        continue;
      }

      // ---- text_delta / thinking ----
      if (msg.type === 'text_delta' || msg.type === 'thinking') {
        const rawNodeId = msg.nodeId ?? 'assistant';
        let idx = nodeStepIndex[rawNodeId];
        if (idx === undefined) {
          const { displayName, nodeType } = resolveNodeDisplayName(rawNodeId, nodes);
          const step: WorkflowStep = {
            id: `step-${rawNodeId}`,
            nodeId: rawNodeId,
            nodeType,
            displayName,
            status: 'running',
            outputText: '',
            thinkingText: '',
            startTs: msg.timestamp,
            isInterrupt: false,
            interruptResolved: false,
          };
          idx = result.length;
          nodeStepIndex[rawNodeId] = idx;
          result.push(step);
        }
        const step = { ...result[idx] };
        if (msg.type === 'thinking') {
          step.thinkingText += msg.content;
        } else {
          step.outputText += msg.content;
        }
        result[idx] = step;
        continue;
      }

      // ---- done / error ----
      if (msg.type === 'done' || msg.type === 'error') {
        for (let i = 0; i < result.length; i++) {
          if (result[i].status === 'running') {
            result[i] = { ...result[i], status: msg.type === 'error' ? 'error' : 'done' };
          }
        }
      }
    }

    // done/error 时把所有 running step 标记完成
    if (status !== 'running') {
      for (let i = 0; i < result.length; i++) {
        if (result[i].status === 'running') {
          result[i] = { ...result[i], status: status === 'error' ? 'error' : 'done' };
        }
      }
    }

    // activeInterrupt 消失时把所有 waiting interrupt 标记 done
    if (!isInterrupted) {
      for (let i = 0; i < result.length; i++) {
        if (result[i].isInterrupt && !result[i].interruptResolved) {
          const choice = resolvedChoiceRef.current;
          result[i] = {
            ...result[i],
            interruptResolved: true,
            status: 'done',
            resolvedActionLabel: result[i].resolvedActionLabel ?? choice?.actionLabel,
            resolvedFeedback: result[i].resolvedFeedback ?? choice?.feedback,
          };
        }
      }
    }

    return result;
  }, [messages, status, isInterrupted, nodes]);

  // 当 activeInterrupt 存在时，注入最新 interruptData 到 waiting step
  const stepsWithActiveInterrupt = useMemo<WorkflowStep[]>(() => {
    if (!isInterrupted || !activeInterrupt) return steps;
    const result = [...steps];
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].isInterrupt && result[i].status === 'waiting') {
        result[i] = { ...result[i], interruptData: activeInterrupt };
        break;
      }
    }
    return result;
  }, [steps, isInterrupted, activeInterrupt]);

  return { steps: stepsWithActiveInterrupt, handleResume: wrappedHandleResume };
}
