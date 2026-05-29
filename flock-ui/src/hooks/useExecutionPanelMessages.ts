import { useMemo, useEffect } from 'react';
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
  // 1. 用户自定义 label
  if (node?.data?.label && typeof node.data.label === 'string') {
    return { displayName: node.data.label, nodeType };
  }
  // 2. nodeConfig 类型名
  const cfg = nodeConfig[nodeType as keyof typeof nodeConfig];
  if (cfg) {
    return { displayName: cfg.display, nodeType };
  }
  // 3. 兜底：把 "answer-1780021304116" 变成 "answer"
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

  /**
   * 把 raw messages 转换为 WorkflowStep[]
   * 规则：
   *  - 每个 nodeId 对应一个 step（按首次出现创建）
   *  - text_delta / thinking 追加到对应 step 的文本
   *  - interrupt 类型 → isInterrupt=true 的 step
   *  - user 消息 → 将所有 interrupt step 标记为 resolved
   */
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
        result.push(step);
        // 中断不建立 nodeStepIndex，避免后续消息追加到错误 step
        continue;
      }

      // ---- user 消息 → 将待处理 interrupt 全部标记 resolved ----
      if (msg.type === 'user') {
        interruptIndices.forEach((idx) => {
          result[idx] = { ...result[idx], interruptResolved: true, status: 'done' };
        });
        // user 消息不生成 step，直接跳过
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

      // ---- info / done / error ----
      if (msg.type === 'done' || msg.type === 'error') {
        // 把当前所有 running step 标记完成
        for (let i = 0; i < result.length; i++) {
          if (result[i].status === 'running') {
            result[i] = { ...result[i], status: msg.type === 'error' ? 'error' : 'done' };
          }
        }
      }
    }

    // 运行中时，最后一个 running step 保持 streaming 状态
    // done/error 时全部 resolve
    if (status !== 'running') {
      for (let i = 0; i < result.length; i++) {
        if (result[i].status === 'running') {
          result[i] = { ...result[i], status: status === 'error' ? 'error' : 'done' };
        }
      }
    }

    // 如果 activeInterrupt 已消失（resolved），把所有 waiting step 标记 done
    if (!isInterrupted) {
      for (let i = 0; i < result.length; i++) {
        if (result[i].isInterrupt && !result[i].interruptResolved) {
          result[i] = { ...result[i], interruptResolved: true, status: 'done' };
        }
      }
    }

    return result;
  }, [messages, status, isInterrupted, nodes]);

  /**
   * 当 activeInterrupt 存在时，找到最后一个 waiting interrupt step，注入 activeInterrupt 数据
   * （因为 interrupt 数据来自 workflowStore，步骤里的 interruptData 可能需要补全）
   */
  const stepsWithActiveInterrupt = useMemo<WorkflowStep[]>(() => {
    if (!isInterrupted || !activeInterrupt) return steps;
    const result = [...steps];
    // 从后往前找第一个 waiting interrupt
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].isInterrupt && result[i].status === 'waiting') {
        result[i] = { ...result[i], interruptData: activeInterrupt };
        break;
      }
    }
    return result;
  }, [steps, isInterrupted, activeInterrupt]);

  return { steps: stepsWithActiveInterrupt };
}
