import { invoke } from '@tauri-apps/api/core';

export interface StartAgentParams {
  workdir: string;
  sessionId: string | null;
  assistantId: string | null;
  projectDir?: string | null;
  apiKey?: string | null;
  extraArgs?: string[] | null;
}

export interface RunWorkflowParams {
  workflowId: string;
  input?: any;
  resumeValue?: unknown;
  threadId?: string | null;
  useDraft?: boolean;
}

/**
 * Unified Task Service to manage agent and workflow command invocations.
 */
export const taskService = {
  /**
   * Start the conversational agent engine.
   */
  async startAgent(params: StartAgentParams): Promise<void> {
    await invoke('start_agent', {
      workdir: params.workdir,
      sessionId: params.sessionId,
      assistantId: params.assistantId,
      projectDir: params.projectDir ?? null,
      apiKey: params.apiKey ?? null,
      extraArgs: params.extraArgs ?? null,
    });
  },

  /**
   * Stop the conversational agent engine.
   */
  async stopAgent(sessionId: string | null): Promise<void> {
    await invoke('stop_agent', { sessionId });
  },

  /**
   * Run or resume a visual workflow.
   */
  async runWorkflow(params: RunWorkflowParams): Promise<void> {
    await invoke('run_workflow', {
      workflowId: params.workflowId,
      input: params.input ?? null,
      resumeValue: params.resumeValue ?? null,
      threadId: params.threadId ?? null,
      thread_id: params.threadId ?? null, // keep compatibility for both casings if any
      useDraft: params.useDraft ?? false,
      use_draft: params.useDraft ?? false,
    });
  },

  /**
   * Stop a running workflow.
   */
  async stopWorkflow(workflowId: string): Promise<void> {
    await invoke('stop_workflow', { workflowId });
  },

  /**
   * Check if a task is running in the unified execution manager.
   */
  async isTaskRunning(taskId: string): Promise<boolean> {
    return await invoke<boolean>('is_task_running_cmd', { taskId });
  },
};
