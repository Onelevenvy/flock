export interface ExecutionMessage {
  type: 'user' | 'text_delta' | 'thinking' | 'info' | 'error' | 'done';
  content: string;
  nodeId?: string;
  timestamp: number;
}

export interface HumanAction {
  key: string;
  label: string;
  enable_feedback?: boolean;
}

export interface InterruptData {
  node_id?: string;
  title?: string;
  actions?: HumanAction[];
  interaction_type?: string;
}

/** Dify 风格的步骤列表单条 */
export interface WorkflowStep {
  /** 步骤唯一 key */
  id: string;
  /** 节点 ID（原始） */
  nodeId: string;
  /** 节点类型（llm / answer / human / ...） */
  nodeType: string;
  /** 显示名：用户 label > 类型名 */
  displayName: string;
  /** 执行状态 */
  status: 'running' | 'done' | 'error' | 'waiting';
  /** 累计输出文本 */
  outputText: string;
  /** thinking 文本 */
  thinkingText: string;
  /** 耗时 ms，done 时才有 */
  durationMs?: number;
  /** token 数，done 时才有 */
  tokens?: number;
  /** 启动时间戳 */
  startTs: number;
  /** 是否为 interrupt 步骤（人工审查） */
  isInterrupt: boolean;
  /** interrupt 数据（isInterrupt=true 时） */
  interruptData?: InterruptData;
  /** interrupt 是否已处理 */
  interruptResolved: boolean;
  /** 用户已选的 action label（已处理时显示） */
  resolvedActionLabel?: string;
}

export interface ExecutionPanelProps {
  status: 'idle' | 'running' | 'done' | 'error';
  messages: ExecutionMessage[];
  onClose: () => void;
  startWorkflow: (input: string) => Promise<void>;
  stopWorkflow: () => Promise<void>;
  resumeWorkflow: (choiceValue: unknown) => Promise<void>;
}
