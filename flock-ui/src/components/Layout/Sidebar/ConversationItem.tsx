import { useState } from 'react';
import { Avatar, Box, Group, Text, TextInput, Menu, ActionIcon, Stack } from '@mantine/core';
import { IconDotsVertical, IconEdit, IconTrash } from '@tabler/icons-react';
import { ConversationInfo } from '../../../types/workspace';
import { useTranslation } from 'react-i18next';

export interface ConversationAppMeta {
  icon: string;
  name: string;
  type: 'assistant' | 'workflow';
}

export function ConversationItem({
  conv,
  isActive,
  appMeta,
  onSelect,
  onDelete,
  onRename,
}: {
  conv: ConversationInfo;
  isActive: boolean;
  appMeta?: ConversationAppMeta;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(conv.title);
  const displayTitle = conv.title?.trim() || appMeta?.name || t('sidebar.newConversation');

  const handleRenameSubmit = () => {
    if (editVal.trim()) onRename(editVal.trim());
    setEditing(false);
  };

  return (
    <Group
      wrap="nowrap"
      gap={0}
      style={{
        borderRadius: 8,
        background: isActive ? 'var(--flock-accent-soft)' : 'transparent',
        border: isActive ? '1px solid var(--flock-border-dim)' : '1px solid transparent',
        marginBottom: 2,
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        paddingLeft: 24, // indentation for tree
      }}
    >
      <Box
        style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
        onClick={onSelect}
      >
        <Avatar
          size={20}
          radius={7}
          style={{
            flexShrink: 0,
            background: appMeta?.type === 'workflow' ? 'rgba(20, 184, 166, 0.12)' : 'var(--flock-accent-soft)',
            color: appMeta?.type === 'workflow' ? 'var(--mantine-color-teal-6)' : 'var(--flock-accent)',
            fontSize: 12,
            border: isActive ? '1px solid var(--flock-accent)' : '1px solid var(--flock-border-subtle)',
          }}
        >
          {appMeta?.icon || '💬'}
        </Avatar>
        {editing ? (
          <TextInput
            size="xs"
            value={editVal}
            onChange={(e) => setEditVal(e.currentTarget.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            style={{ flex: 1, minWidth: 0 }}
            styles={{ input: { height: 24, padding: '0 6px', fontSize: 12 } }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text
              size="sm"
              fw={isActive ? 600 : 400}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isActive ? 'var(--flock-text-primary)' : 'var(--flock-text-secondary)',
                lineHeight: 1.25,
              }}
            >
              {displayTitle}
            </Text>
            {appMeta && conv.title?.trim() && conv.title.trim() !== appMeta.name && (
              <Text
                size="xs"
                c="dimmed"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                  lineHeight: 1.15,
                }}
              >
                {appMeta.name}
              </Text>
            )}
          </Stack>
        )}
      </Box>
      <Menu shadow="md" position="right-start">
        <Menu.Target>
          <ActionIcon
            size="xs"
            variant="transparent"
            color="gray"
            style={{ marginRight: 4, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconDotsVertical size={12} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconEdit size={14} />}
            onClick={() => {
              setEditVal(conv.title);
              setEditing(true);
            }}
          >
            {t('sidebar.rename')}
          </Menu.Item>
          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={onDelete}>
            {t('sidebar.deleteConversation')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
