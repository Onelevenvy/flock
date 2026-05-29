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

export interface ExecutionPanelProps {
  status: 'idle' | 'running' | 'done' | 'error';
  messages: ExecutionMessage[];
  onClose: () => void;
  startWorkflow: (input: string) => Promise<void>;
  stopWorkflow: () => Promise<void>;
  resumeWorkflow: (choiceValue: unknown) => Promise<void>;
}
