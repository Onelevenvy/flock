import { Box } from '@mantine/core';
import { useAgentStore } from '../../store/agentStore';
import { useUiStore } from '../../store/uiStore';
import { Header } from '../../components/Layout/Header';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { InputBar } from '../../components/chat/InputBar';
import { ToolApprovalInline } from '../../components/chat/ToolApproval/ToolApprovalInline';
import { FileTreePanel } from './components/FileTreePanel';
import { PreviewPanel } from './components/PreviewPanel';

export function WorkspaceView() {
  const { isPreviewOpen } = useUiStore();
  const messages = useAgentStore((s) => s.messages);
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);

  // 取队首待审批（每次只处理一个）
  const firstPending = pendingApprovals[0] ?? null;

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
            <PreviewPanel embedded />
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
            <Header />
            <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <ChatPanel messages={messages} />
              <ToolApprovalInline approval={firstPending} />
              <InputBar />
            </Box>
          </Box>
        </>
      ) : (
        /* 无预览时：Chat 宽版面板占满剩余空间 */
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
          <Header />
          <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <ChatPanel messages={messages} />
            <ToolApprovalInline approval={firstPending} />
            <InputBar />
          </Box>
        </Box>
      )}
    </>
  );
}

export default WorkspaceView;
