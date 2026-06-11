import { useMemo, useEffect, useRef } from 'react';
import { ExecutionMessage, WorkflowStep, InterruptData, HumanAction } from '@/components/chat/workflow/ExecutionPanel/types';
import { nodeConfig } from '@/pages/Workflow/nodeConfig';
import type { Node } from 'reactflow';

interface UseExecutionPanelMessagesProps {
  messages: ExecutionMessage[];
  status: 'idle' | 'running' | 'done' | 'error';
  isInterrupted: boolean;
  activeInterrupt: InterruptData | null;
  /** choice: action key, feedback: user comment, actionLabel: human-readable label of the chosen action */
  handleResume: (choice: string, feedback?: string, actionLabel?: string) => void;
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

/** 一问一答的轮次 */
export interface ExecutionRound {
  /** 轮次序号（从 0 开始） */
  index: number;
  /** 用户发送的文本（可能为空，如首轮无 user 消息的情况） */
  userText?: string;
  userTimestamp?: number;
  /** 该轮对应的工作流步骤 */
  steps: WorkflowStep[];
}

/** 构建单个 WorkflowStep 列表的纯函数（不含 rounds 概念，内部复用） */
function buildSteps(
  messages: ExecutionMessage[],
  status: 'idle' | 'running' | 'done' | 'error',
  isInterrupted: boolean,
  resolvedChoiceRef: React.MutableRefObject<{ actionLabel: string; feedback?: string } | null>,
  nodes: Node[],
): WorkflowStep[] {
  const result: WorkflowStep[] = [];
  const nodeStepIndex: Record<string, number> = {};
  const interruptIndices: number[] = [];

  for (const msg of messages) {
    // ---- interrupt 事件 ----
    if ((msg as any).type === 'interrupt') {
      let interruptData: InterruptData = {};
      try { interruptData = JSON.parse(msg.content); } catch (_) {}
      const rawNodeId = interruptData.node_id ?? msg.nodeId ?? 'human';

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

    // ---- user 消息 → 将待处理 interrupt 全部标记 resolved ----
    if (msg.type === 'user') {
      const choice = resolvedChoiceRef.current;
      // 兼容历史加载：消息本身可能携带扩展字段 resolvedActionLabel（从数据库恢复时注入）
      const msgAny = msg as any;
      const actionLabel = choice?.actionLabel ?? msgAny.resolvedActionLabel;
      const feedbackText = choice?.feedback ?? msgAny.resolvedFeedback;
      interruptIndices.forEach((idx) => {
        result[idx] = {
          ...result[idx],
          interruptResolved: true,
          status: 'done',
          resolvedActionLabel: actionLabel,
          resolvedFeedback: feedbackText,
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
        // 当全新的节点开始生成输出时，说明上一个处于 running 状态的节点已流转完毕，将其标记为 done
        for (let i = 0; i < result.length; i++) {
          if (result[i].status === 'running') {
            result[i] = { ...result[i], status: 'done' };
          }
        }

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
      if (msg.type === 'error' && msg.nodeId) {
        const errorNodeId = msg.nodeId;
        let idx = nodeStepIndex[errorNodeId];
        if (idx === undefined) {
          const { displayName, nodeType } = resolveNodeDisplayName(errorNodeId, nodes);
          const step: WorkflowStep = {
            id: `step-${errorNodeId}`,
            nodeId: errorNodeId,
            nodeType,
            displayName,
            status: 'error',
            outputText: `❌ 运行出错：${msg.content || 'Unknown error'}`,
            thinkingText: '',
            startTs: msg.timestamp,
            isInterrupt: false,
            interruptResolved: false,
          };
          nodeStepIndex[errorNodeId] = result.length;
          result.push(step);
        } else {
          result[idx].status = 'error';
          result[idx].outputText = `❌ 运行出错：${msg.content || 'Unknown error'}`;
        }
      }

      for (let i = 0; i < result.length; i++) {
        if (result[i].status === 'running') {
          result[i] = { ...result[i], status: msg.type === 'error' ? 'error' : 'done' };
          if (msg.type === 'error' && !result[i].outputText) {
            result[i].outputText = `❌ 运行出错：${msg.content || 'Unknown error'}`;
          }
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
}

/** 按照 user 消息边界把 messages 切分成轮次，返回每轮的 {userText, steps} */
function buildRounds(
  messages: ExecutionMessage[],
  status: 'idle' | 'running' | 'done' | 'error',
  isInterrupted: boolean,
  resolvedChoiceRef: React.MutableRefObject<{ actionLabel: string; feedback?: string } | null>,
  nodes: Node[],
): ExecutionRound[] {
  // 先把 messages 按 user 消息边界分组
  const groups: { userMsg?: ExecutionMessage; msgs: ExecutionMessage[] }[] = [];
  let current: { userMsg?: ExecutionMessage; msgs: ExecutionMessage[] } = { msgs: [] };

  for (const msg of messages) {
    if (msg.type === 'user') {
      // resume 类型的 user 消息（由历史加载注入，携带 resolvedActionLabel 扩展字段）
      // 不作为新轮次的起点，而是并入当前组的 msgs，让 buildSteps 正确处理 interrupt resolved
      const msgAny = msg as any;
      if (msgAny.resolvedActionLabel !== undefined) {
        current.msgs.push(msg);
        continue;
      }
      // 如果当前组已有内容，先保存（前一轮的消息）
      // 新建本轮：以 user 消息为起点
      groups.push(current);
      current = { userMsg: msg, msgs: [] };
    } else {
      current.msgs.push(msg);
    }
  }
  groups.push(current);

  // 过滤掉完全空的首组（没有 userMsg 且没有 msgs）
  let nonEmpty = groups.filter(g => g.userMsg || g.msgs.length > 0);

  // 如果工作流正在启动/运行中，但由于后端消息尚未送达使得轮次为空，
  // 我们手动注入一个初始运行轮次，以此实现一点击发送就立刻展示加载栏的白白秒开体验
  if (nonEmpty.length === 0 && status === 'running') {
    nonEmpty = [{
      msgs: []
    }];
  }

  return nonEmpty.map((g, i) => {
    // 给每轮单独构建 steps，传入 user msg 之后的那些消息
    let roundSteps = buildSteps(
      g.msgs,
      // 最后一轮才用真实 status
      i === nonEmpty.length - 1 ? status : 'done',
      // 最后一轮才用真实 isInterrupted
      i === nonEmpty.length - 1 ? isInterrupted : false,
      resolvedChoiceRef,
      nodes,
    );

    // 刚点击人工发送的启动过渡期，如果当前步骤列表为空，注入一个转圈圈的虚拟步骤，避免空白屏
    if (i === nonEmpty.length - 1 && status === 'running' && roundSteps.length === 0) {
      roundSteps = [{
        id: 'workflow-starting-virtual-step',
        nodeId: 'starting',
        nodeType: 'start',
        displayName: '正在启动工作流...',
        status: 'running',
        outputText: '',
        thinkingText: '',
        startTs: Date.now(),
        isInterrupt: false,
        interruptResolved: false,
      }];
    }

    return {
      index: i,
      userText: g.userMsg?.content,
      userTimestamp: g.userMsg?.timestamp,
      steps: roundSteps,
    };
  });
}

export function useExecutionPanelMessages({
  messages,
  status,
  isInterrupted,
  activeInterrupt,
  handleResume,
  nodes,
}: UseExecutionPanelMessagesProps) {
  const resolvedChoiceRef = useRef<{ actionLabel: string; feedback?: string } | null>(null);
  const activeInterruptRef = useRef<InterruptData | null>(activeInterrupt);
  useEffect(() => {
    activeInterruptRef.current = activeInterrupt;
  }, [activeInterrupt]);

  // 包装 handleResume：调用时立即记录选择的 action label，并将 label 一并传入下游
  const wrappedHandleResume = useMemo(() => {
    return (choice: string, feedback?: string) => {
      const actions = activeInterruptRef.current?.actions ?? [];
      const act = actions.find((a: HumanAction) => a.key === choice);
      const label = act?.label ?? choice;
      resolvedChoiceRef.current = {
        actionLabel: label,
        feedback: feedback || undefined,
      };
      // 将 label 传递给 handleResume，最终传入 resumeWorkflow 以便 dispatch user 消息时附带
      handleResume(choice, feedback, label);
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

  // ── 扁平 steps（向后兼容，如果某些地方还用 steps） ──
  const steps = useMemo<WorkflowStep[]>(() => {
    return buildSteps(messages, status, isInterrupted, resolvedChoiceRef, nodes);
  }, [messages, status, isInterrupted, nodes]);

  // ── 带 activeInterrupt 注入的 steps ──
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

  // ── 轮次（rounds）——用于调试面板按轮渲染 ──
  const rounds = useMemo<ExecutionRound[]>(() => {
    const rawRounds = buildRounds(messages, status, isInterrupted, resolvedChoiceRef, nodes);
    // 最后一轮注入 activeInterrupt 到 waiting step
    if (!isInterrupted || !activeInterrupt || rawRounds.length === 0) return rawRounds;
    const lastRound = rawRounds[rawRounds.length - 1];
    const updatedSteps = [...lastRound.steps];
    for (let i = updatedSteps.length - 1; i >= 0; i--) {
      if (updatedSteps[i].isInterrupt && updatedSteps[i].status === 'waiting') {
        updatedSteps[i] = { ...updatedSteps[i], interruptData: activeInterrupt };
        break;
      }
    }
    return [
      ...rawRounds.slice(0, -1),
      { ...lastRound, steps: updatedSteps },
    ];
  }, [messages, status, isInterrupted, activeInterrupt, nodes]);

  return { steps: stepsWithActiveInterrupt, rounds, handleResume: wrappedHandleResume };
}
