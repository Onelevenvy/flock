import { Box } from '@mantine/core';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { SkillsPage } from '../../pages/Skills';
import { AssistantPage } from '../../pages/Assistant';
import { HomeView } from '../../pages/Home';
import { WorkspaceView } from '../../pages/Workspace';
import { PlaceholderPage } from '../../pages/Placeholder';
import { SchedulePage } from '../../pages/Schedule';
import { WorkflowPage } from '../../pages/Workflow';
import { useUiStore } from '../../store/uiStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAgentStore } from '../../store/agentStore';
import { IconBoxMultiple, IconLego } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export function MainLayout() {
  const { t } = useTranslation();
  const { currentView } = useUiStore();
  const { activeWorkspaceId, activeConversationId } = useWorkspaceStore();
  const messages = useAgentStore((s) => s.messages);

  // 核心逻辑：在 home 视图下，如果选中了具体对话并且有对话消息，则分发到「工作区视图」，否则展示「主页/欢迎视图」（以便选择助手开始新对话）
  const showWorkspace = currentView === 'home' && !!activeWorkspaceId && !!activeConversationId && messages.length > 0;

  return (
    <Box
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--flock-bg-deepest)',
        overflow: 'hidden',
      }}
    >
      <TitleBar />

      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          padding: '0 12px 12px 12px',
          gap: '12px',
          overflow: 'hidden',
        }}
      >
        <Sidebar />

        {currentView === 'skills' ? (
          <SkillsPage />
        ) : currentView === 'assistant' ? (
          <AssistantPage />
        ) : currentView === 'workflow' ? (
          <WorkflowPage />
        ) : currentView === 'collaboration' ? (
          <PlaceholderPage title={t('sidebar.collaboration')} icon={IconBoxMultiple} description={t('placeholder.collaborationDesc')} />
        ) : currentView === 'extension' ? (
          <PlaceholderPage title={t('placeholder.extension')} icon={IconLego} description={t('placeholder.extensionDesc')} />
        ) : currentView === 'schedule' ? (
          <SchedulePage />
        ) : showWorkspace ? (
          /* 工作区模式：展示独立集成的 Workspace 视图 */
          <WorkspaceView />
        ) : (
          /* 欢迎首页模式：居中欢迎页 */
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
            <HomeView />
          </Box>
        )}
      </Box>
    </Box>
  );
}
