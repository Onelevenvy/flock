import { useMemo } from 'react';
import { Box } from '@mantine/core';
import { useAgentStore } from '@/store/agentStore';
import { useUiStore } from '@/store/uiStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Header } from '@/components/Layout/Header';
import { ChatPanel } from '@/components/chat/assistant/ChatPanel';
import { InputBar } from '@/components/chat/assistant/InputBar';
import { ToolApprovalInline } from '@/components/chat/assistant/ToolApproval/ToolApprovalInline';
import { HumanTakeoverBanner } from '@/components/chat/assistant/ToolApproval/HumanTakeoverBanner';
import { FileTreePanel } from './components/FileTreePanel';
import { EnvironmentPanel } from './components/EnvironmentPanel';
import { WorkflowChatPanel } from '@/components/chat/workflow/WorkflowChatPanel';
import { useWorkflowQuery } from '@/hooks/useWorkflow';

/** 从 conversationAssistants 里解析出工作流 ID（格式：workflow:<id>） */
function parseWorkflowConvId(assistantId: string | undefined): string | null {
  if (!assistantId?.startsWith('workflow:')) return null;
  return assistantId.slice('workflow:'.length) || null;
}

function AssistantChatContent() {
  const messages = useAgentStore((s) => s.messages);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const humanTakeover = useAgentStore((s) => s.humanTakeover);
  const firstPending = pendingApprovals[0] ?? null;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <ChatPanel messages={messages} />
      <ToolApprovalInline approval={firstPending} />
      {humanTakeover && <HumanTakeoverBanner takeover={humanTakeover} />}
      <InputBar />
    </Box>
  );
}

function WorkflowChatContent({ workflowId, threadId }: { workflowId: string; threadId: string }) {
  const { data: workflow } = useWorkflowQuery(workflowId);

  // 解析 start 节点的 variables
  const startVariables = useMemo(() => {
    if (!workflow?.config?.nodes) return [{ type: 'string', name: 'query', label: 'Query', required: true }];
    const startNode = workflow.config.nodes.find((n: any) => n.type === 'start');
    return (startNode?.data?.variables as any[]) ?? [
      { type: 'string', name: 'query', label: 'Query', required: true },
    ];
  }, [workflow]);

  const nodes = workflow?.config?.nodes ?? [];
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const firstPending = pendingApprovals[0] ?? null;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <WorkflowChatPanel
        workflowId={workflowId}
        workflowName={workflow?.name ?? '工作流'}
        threadId={threadId}
        startVariables={startVariables}
        nodes={nodes}
      />
      <ToolApprovalInline approval={firstPending} />
    </Box>
  );
}

export function WorkspaceView() {
  const { isPreviewOpen } = useUiStore();
  const { activeConversationId, conversationAssistants } = useWorkspaceStore();

  // 判断当前对话是否为工作流对话
  const assistantId = activeConversationId ? conversationAssistants[activeConversationId] : undefined;
  const workflowId = parseWorkflowConvId(assistantId);
  const isWorkflowConv = !!workflowId;
  const threadId = activeConversationId ?? '';

  // 中间主内容区（助手 or 工作流）
  // key={threadId} 确保切换对话时组件完全重置，消息状态隔离
  const mainContent = isWorkflowConv ? (
    <WorkflowChatContent key={threadId} workflowId={workflowId!} threadId={threadId} />
  ) : (
    <AssistantChatContent />
  );

  return (
    <>
      {/* 1. 左侧工作空间文件树面板 */}
      <FileTreePanel />

      {/* 2. 中间/右侧：带沙盒预览的多栏布局 */}
      {isPreviewOpen ? (
        <>
          {/* 中间：预览沙盒卡片 */}
          <Box
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
              background: 'var(--flock-bg-base)',
              borderRadius: '16px',
              border: '1px solid var(--flock-border-subtle)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
            }}
          >
            <EnvironmentPanel embedded />
          </Box>

          {/* 右侧：窄版 Chat 面板 */}
          <Box
            style={{
              width: 420,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--flock-bg-surface)',
              borderRadius: '16px',
              border: '1px solid var(--flock-border-subtle)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* 工作流对话有自己的 header，助手对话才需要外层 Header */}
            {!isWorkflowConv && <Header />}
            {mainContent}
          </Box>
        </>
      ) : (
        /* 无预览时：主面板占满剩余空间 */
        <Box
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            background: 'var(--flock-bg-surface)',
            borderRadius: '16px',
            border: '1px solid var(--flock-border-subtle)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          }}
        >
          {/* 工作流对话有自己的 header，助手对话才需要外层 Header */}
          {!isWorkflowConv && <Header />}
          {mainContent}
        </Box>
      )}
    </>
  );
}

export default WorkspaceView;
