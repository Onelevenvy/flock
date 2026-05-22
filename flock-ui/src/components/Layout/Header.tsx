import {
  Tooltip,
  ActionIcon,
  Box,
  Group,
  Badge,
  Text,
} from '@mantine/core';
import {
  IconLayoutSidebar,
  IconCircleFilled,
  IconDeviceDesktop,
} from '@tabler/icons-react';

import { useAgentStore } from '../../store/agentStore';
import { useUiStore } from '../../store/uiStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAssistantsQuery } from '../../hooks/useAssistants';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

const STATUS_COLOR: Record<string, string> = {
  disconnected: 'gray',
  connecting: 'yellow',
  ready: 'teal',
  thinking: 'blue',
  error: 'red',
};

export function Header() {
  const { t } = useTranslation();
  const status = useAgentStore((s) => s.status);
  const { toggleSidebar, isPreviewOpen, previewFile, setPreviewFile } = useUiStore();
  const statusColor = STATUS_COLOR[status] ?? 'gray';
  const statusLabel = t(`header.status.${status}`, { defaultValue: status });

  const { activeConversationId, conversationAssistants } = useWorkspaceStore();
  const { data: assistants = [] } = useAssistantsQuery();

  // Find the assistant mapped to the active conversation
  const assistantId = activeConversationId ? conversationAssistants[activeConversationId] : null;
  const currentAssistant = assistants.find((a) => a.id === assistantId);

  // Determine assistant display name
  const assistantName = currentAssistant
    ? currentAssistant.name
    : (assistantId === '__xiaof__' || !assistantId)
    ? t('header.defaultAssistant')
    : t('header.customAssistant');

  const isComputerOpen = isPreviewOpen && (
    previewFile?.extension === 'vnc' ||
    previewFile?.path === '.flock/sandbox/screenshot.png' ||
    previewFile?.path === 'vnc'
  );

  const handleToggleComputer = async () => {
    if (isComputerOpen) {
      setPreviewFile(null);
    } else {
      try {
        const vncUrl = await invoke<string | null>('get_active_sandbox_vnc_url');
        if (vncUrl) {
          setPreviewFile({
            path: vncUrl,
            content: '',
            extension: 'vnc',
          });
        } else {
          setPreviewFile({
            path: 'vnc',
            content: '',
            extension: 'vnc',
          });
        }
      } catch (e) {
        setPreviewFile({
          path: 'vnc',
          content: '',
          extension: 'vnc',
        });
      }
    }
  };

  return (
    <Box
      style={{
        background: 'var(--flock-bg-deep)',
        borderBottom: '1px solid var(--flock-border-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 48,
        flexShrink: 0,
      }}
    >
      <Group gap={8}>
        <Tooltip label={t('header.toggleSidebar')} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={toggleSidebar}
          >
            <IconLayoutSidebar size={16} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('header.toggleComputer', { defaultValue: '显示/隐藏电脑桌面' })} withArrow>
          <ActionIcon
            variant="subtle"
            color={isComputerOpen ? 'blue' : 'gray'}
            size="sm"
            onClick={handleToggleComputer}
          >
            <IconDeviceDesktop size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group gap={12}>
        {/* Active Assistant display next to status */}
        {assistantId && assistantId !== '__xiaof__' ? (
          <Badge
            variant="light"
            color="blue"
            size="sm"
            style={{ textTransform: 'none', fontWeight: 600, height: 22 }}
          >
            {assistantName}
          </Badge>
        ) : (
          <Text size="xs" fw={500} c="dimmed">
            {assistantName}
          </Text>
        )}

        <Tooltip label={t('header.agentStatus', { status: statusLabel })} withArrow>
          <ActionIcon variant="transparent" size="sm" style={{ cursor: 'default' }}>
            <IconCircleFilled
              size={12}
              color={`var(--mantine-color-${statusColor}-5)`}
              style={{
                animation: (status === 'thinking' || status === 'connecting') ? 'blink 1.5s infinite' : 'none'
              }}
            />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
}
