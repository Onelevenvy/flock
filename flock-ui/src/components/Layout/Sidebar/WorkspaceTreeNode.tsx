import { Box, Group, Text, ActionIcon, Menu, Collapse, Loader, Stack } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconDotsVertical, IconTrash } from '@tabler/icons-react';
import { ConversationItem } from './ConversationItem';
import { useConversationsQuery } from '../../../hooks/useWorkspaces';
import { useTranslation } from 'react-i18next';

export function WorkspaceTreeNode({
  ws,
  isExpanded,
  onToggle,
  activeWorkspaceId,
  activeConversationId,
  onSelectConversation,
  onDeleteWorkspace,
  onDeleteConversation,
  onRenameConversation,
  onNewConversation: _onNewConversation,
}: {
  ws: { id: string; name: string };
  isExpanded: boolean;
  onToggle: () => void;
  activeWorkspaceId: string | null;
  activeConversationId: string | null;
  onSelectConversation: (wsId: string, convId: string) => void;
  onDeleteWorkspace: (wsId: string) => void;
  onDeleteConversation: (wsId: string, convId: string) => void;
  onRenameConversation: (wsId: string, convId: string, title: string) => void;
  onNewConversation: (wsId: string) => void;
}) {
  const { t } = useTranslation();
  const isWsActive = ws.id === activeWorkspaceId;
  // 仅在当前工作区节点展开时才获取并监听该工作区的会话列表
  const { data: conversations = [], isLoading } = useConversationsQuery(isExpanded ? ws.id : null);

  return (
    <Box mb={4}>
      <Group
        wrap="nowrap"
        gap={0}
        style={{
          borderRadius: 8,
          background: isWsActive ? 'rgba(21, 90, 239, 0.06)' : 'transparent',
          transition: 'all 0.15s ease',
          cursor: 'pointer',
        }}
        className="ws-item"
      >
        <Box
          style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
          onClick={onToggle}
        >
          <ActionIcon size="xs" variant="transparent" color="gray" style={{ flexShrink: 0 }}>
            {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
          <Text
            size="sm"
            fw={isWsActive ? 600 : 500}
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: isWsActive ? 'var(--flock-text-primary)' : 'var(--flock-text-secondary)',
            }}
          >
            {ws.name}
          </Text>
        </Box>
        <Group gap={0} wrap="nowrap" pr={4}>
          <Menu shadow="md" position="right-start">
            <Menu.Target>
              <ActionIcon
                size="xs"
                variant="transparent"
                color="gray"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDotsVertical size={12} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => onDeleteWorkspace(ws.id)}>
                {t('sidebar.deleteWorkspace')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Collapse in={isExpanded}>
        <Stack gap={0} mt={2}>
          {isLoading ? (
            <Group gap={6} pl={32} py={4}>
              <Loader size={10} color="blue" />
              <Text size="xs" c="dimmed">{t('common.loading')}</Text>
            </Group>
          ) : conversations.length === 0 ? (
            <Text size="xs" c="dimmed" pl={32} py={4}>{t('sidebar.noConversation')}</Text>
          ) : (
            conversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConversationId && isWsActive}
                onSelect={() => onSelectConversation(ws.id, conv.id)}
                onDelete={() => onDeleteConversation(ws.id, conv.id)}
                onRename={(title) => onRenameConversation(ws.id, conv.id, title)}
              />
            ))
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}
