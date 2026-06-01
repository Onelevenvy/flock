import {
  Box,
  Text,
  Badge,
  Group,
  ActionIcon,
  Stack,
  Divider,
  ScrollArea,
  Code,
  ThemeIcon,
} from '@mantine/core';
import {
  IconSparkles,
  IconX,
  IconChevronRight,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { SkillInfo } from '@/pages/Skills/types';
import { SOURCE_COLORS } from '@/pages/Skills/helpers';
import { parseMultiLang } from '@/utils/i18n';

export function SkillDetailPanel({
  skill,
  onClose,
}: {
  skill: SkillInfo;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box
      style={{
        width: 420,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-base)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        minHeight: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Group justify="space-between" p="md" pb="sm">
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
          <IconX size={16} />
        </ActionIcon>
      </Group>
 
      <Box px="md" pb="md">
        <Group gap="sm" mb="xs">
          <ThemeIcon size={40} radius="md" variant="light" color="teal">
            <IconSparkles size={22} />
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} style={{ color: 'var(--flock-text-bright)' }} truncate>
              {parseMultiLang(skill.display_name) || skill.name}
            </Text>
            <Group gap={6}>
              <Badge size="xs" variant="light" color={SOURCE_COLORS[skill.source] || 'gray'}>
                {skill.source}
              </Badge>
              <Badge size="xs" variant="light" color="cyan">
                {skill.execution_context}
              </Badge>
            </Group>
          </Box>
        </Group>
        <Text size="xs" c="dimmed">{skill.description || t('skills.skills.noDescription')}</Text>
      </Box>

      <Divider />

      <Box px="md" pt="sm">
        <Stack gap="xs">
          {skill.model && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{t('skills.skills.model')}</Text>
              <Code style={{ fontSize: 11 }}>{skill.model}</Code>
            </Group>
          )}
          {skill.effort && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{t('skills.skills.effort')}</Text>
              <Text size="xs">{skill.effort}</Text>
            </Group>
          )}
          {skill.argument_hint && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">{t('skills.skills.argumentHint')}</Text>
              <Text size="xs">{skill.argument_hint}</Text>
            </Group>
          )}
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{t('skills.skills.userInvocable')}</Text>
            <Text size="xs">{skill.user_invocable ? t('skills.mcp.yes') : t('skills.mcp.no')}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{t('skills.skills.contentLength')}</Text>
            <Text size="xs">{t('skills.skills.characters', { count: skill.content_length })}</Text>
          </Group>
          {skill.allowed_tools.length > 0 && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>{t('skills.skills.allowedTools')}</Text>
              <Group gap={4}>
                {skill.allowed_tools.map((t) => (
                  <Badge key={t} size="xs" variant="outline">{t}</Badge>
                ))}
              </Group>
            </Box>
          )}
          {skill.paths.length > 0 && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>{t('skills.skills.paths')}</Text>
              <Stack gap={2}>
                {skill.paths.map((p) => (
                  <Code key={p} style={{ fontSize: 11 }}>{p}</Code>
                ))}
              </Stack>
            </Box>
          )}
          {skill.when_to_use && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>{t('skills.skills.whenToUse')}</Text>
              <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>{skill.when_to_use}</Text>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider my="sm" />

      <Group gap="xs" px="md" pb="sm">
        <IconChevronRight size={14} color="var(--flock-text-dim)" />
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.05em' }}>
          {t('skills.skills.contentPreview')}
        </Text>
      </Group>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} px="md" pb="md">
        <Code
          block
          style={{
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'var(--flock-bg-surface)',
            padding: 12,
            borderRadius: 8,
            maxHeight: '100%',
          }}
        >
          {skill.content || t('skills.skills.emptyContent')}
        </Code>
      </ScrollArea>
    </Box>
  );
}
