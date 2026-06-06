import { Box, Divider } from '@mantine/core';
import { useUiStore } from '@/store/uiStore';
import SettingsModal from '@/components/Settings';
import { FlockLogo } from './FlockLogo';
import { NavigationList } from './NavigationList';
import { WorkspaceSection } from './WorkspaceSection';
import { BottomBar } from './BottomBar';

export function Sidebar() {
  const { isSidebarCollapsed, isSettingsOpen, setSettingsOpen } = useUiStore();

  if (isSidebarCollapsed) return null;

  return (
    <>
      <Box
        style={{
          width: 260,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--flock-bg-base)',
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          border: '1px solid var(--flock-border-subtle)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <FlockLogo />

        <NavigationList />

        <Divider color="dark.6" mx="md" my="sm" style={{ borderColor: 'var(--flock-border-subtle)' }} />

        <WorkspaceSection />

        <BottomBar />
      </Box>

      {/* 设置 Modal */}
      <SettingsModal
        opened={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
