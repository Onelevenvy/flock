import { Box, Group, Text, Avatar, Menu, ActionIcon, Tooltip, Badge, Button } from '@mantine/core';
import { IconDotsVertical, IconEdit, IconTrash, IconLock, IconMessageCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { type Assistant } from '../../types/assistant';

export function AssistantCard({
  assistant,
  onEdit,
  onDelete,
  onChat,
}: {
  assistant: Assistant;
  onEdit: () => void;
  onDelete: () => void;
  onChat?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box
      p="md"
      onClick={onEdit}
      style={{
        borderRadius: 14,
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.2s ease',
        position: 'relative',
        cursor: 'pointer',
      }}
      className="hover-card-lift"
    >
      <Group gap="sm" wrap="nowrap" justify="space-between">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar
            size={40}
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #155aef 0%, #36bffa 100%)',
              fontSize: 20,
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(21, 90, 239, 0.2)',
            }}
          >
            {assistant.icon}
          </Avatar>
          <Box style={{ minWidth: 0 }}>
            <Group gap={4} wrap="nowrap">
              <Text size="sm" fw={700} truncate style={{ color: 'var(--flock-text-bright)' }}>
                {assistant.name}
              </Text>
              {assistant.is_builtin && (
                <Tooltip label={t('assistant.card.builtinLabel')} withArrow>
                  <IconLock size={11} color="var(--flock-text-dim)" style={{ flexShrink: 0 }} />
                </Tooltip>
              )}
            </Group>
            {assistant.model && (
              <Text size="xs" c="dimmed" truncate>
                {assistant.model.split(':')[1] || assistant.model}
              </Text>
            )}
          </Box>
        </Group>
        <Menu shadow="md" position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={(e) => e.stopPropagation()}>
              <IconDotsVertical size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={onEdit}>
              {t('common.edit')}
            </Menu.Item>
            {!assistant.is_builtin && (
              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={onDelete}>
                {t('common.delete')}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 32 }}>
        {assistant.description || t('assistant.card.noDescription')}
      </Text>

      <Group gap={6} wrap="wrap">
        {assistant.is_builtin && (
          <Badge size="xs" variant="light" color="blue" radius="sm">
            {t('assistant.card.builtinTag')}
          </Badge>
        )}
        {assistant.tools.length > 0 && (
          <Badge size="xs" variant="light" color="blue" radius="sm">
            {t('assistant.card.toolsCount', { count: assistant.tools.length })}
          </Badge>
        )}
        {assistant.skills.length > 0 && (
          <Badge size="xs" variant="light" color="teal" radius="sm">
            {t('assistant.card.skillsCount', { count: assistant.skills.length })}
          </Badge>
        )}
        {assistant.system_prompt && (
          <Badge size="xs" variant="light" color="orange" radius="sm">
            <Group gap={3}>
              <IconMessageCircle size={10} />
              {t('assistant.card.promptTag')}
            </Group>
          </Badge>
        )}
      </Group>

      <Button
        variant="light"
        color="blue"
        fullWidth
        leftSection={<IconMessageCircle size={15} />}
        mt="xs"
        onClick={(e) => {
          e.stopPropagation();
          onChat?.();
        }}
        styles={{
          root: {
            borderRadius: 10,
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }
        }}
      >
        {t('assistant.card.chatBtn')}
      </Button>
    </Box>
  );
}
