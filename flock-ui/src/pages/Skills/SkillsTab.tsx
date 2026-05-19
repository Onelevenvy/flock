import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  SimpleGrid,
  Badge,
  Group,
  LoadingOverlay,
  ThemeIcon,
  ActionIcon,
  Stack,
  Divider,
  ScrollArea,
  Code,
  TextInput,
  SegmentedControl,
  Button,
  Tooltip,
  Modal,
} from '@mantine/core';
import {
  IconSparkles,
  IconX,
  IconSearch,
  IconChevronRight,
  IconFolderPlus,
  IconTrash,
  IconFolder,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { SkillInfo } from './types';
import { SOURCE_COLORS } from './helpers';

function SkillDetailPanel({
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
              {skill.display_name || skill.name}
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

function ExtraDirsModal({
  opened,
  onClose,
  onUpdate,
}: {
  opened: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { t } = useTranslation();
  const [dirs, setDirs] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const fetchDirs = useCallback(() => {
    invoke<string[]>('get_extra_skill_dirs').then(setDirs).catch(console.error);
  }, []);

  useEffect(() => {
    if (opened) {
      fetchDirs();
    }
  }, [opened, fetchDirs]);

  const handleSelectAndAdd = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setAdding(true);
        const updated = await invoke<string[]>('add_extra_skill_dir', { path: selected });
        setDirs(updated);
        onUpdate();
        notifications.show({ title: t('skills.skills.importSuccess'), message: t('skills.skills.importSuccessMsg'), color: 'teal', autoClose: 3000 });
      }
    } catch (e: any) {
      notifications.show({ title: t('skills.skills.importFailed'), message: String(e), color: 'red', autoClose: 5000 });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (path: string) => {
    try {
      const updated = await invoke<string[]>('remove_extra_skill_dir', { path });
      setDirs(updated);
      onUpdate();
      notifications.show({ title: t('skills.skills.removedToast'), message: t('skills.skills.removedToastMsg'), color: 'teal', autoClose: 3000 });
    } catch (e: any) {
      notifications.show({ title: t('skills.skills.removeFailed'), message: String(e), color: 'red', autoClose: 5000 });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('skills.skills.manageModalTitle')}
      size="md"
      styles={{ title: { fontWeight: 600 } }}
    >
      <Stack gap="md" pt="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">{t('skills.skills.manageModalDesc')}</Text>
          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<IconFolderPlus size={14} />}
            loading={adding}
            onClick={handleSelectAndAdd}
          >
            {t('skills.skills.selectFolderBtn')}
          </Button>
        </Group>

        {dirs.length > 0 ? (
          <Stack gap="xs">
            {dirs.map((d) => (
              <Group key={d} gap="xs" p="xs" style={{ borderRadius: 8, border: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
                <IconFolder size={16} color="var(--flock-text-dim)" />
                <Text size="sm" style={{ flex: 1, fontFamily: 'var(--mantine-font-family-monospace)', wordBreak: 'break-all' }}>
                  {d}
                </Text>
                <Tooltip label={t('skills.skills.removeTooltip')}>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemove(d)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        ) : (
          <Box py="xl" style={{ textAlign: 'center' }}>
            <Text size="sm" c="dimmed">{t('skills.skills.noDirs')}</Text>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}

export function SkillsTab() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [searchKey, setSearchKey] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);

  const fetchSkills = useCallback(() => {
    setLoading(true);
    invoke<SkillInfo[]>('list_skills')
      .then(setSkills)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      !searchKey ||
      s.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      s.description.toLowerCase().includes(searchKey.toLowerCase());
    const matchesSource = sourceFilter === 'all' || s.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const availableSources = Array.from(new Set(skills.map((s) => s.source))).sort();

  return (
    <Box
      style={{ height: '100%', display: 'flex', gap: 16, minHeight: 0, overflow: 'hidden' }}
      onClick={() => setSelectedSkill(null)}
    >
      <LoadingOverlay visible={loading} />

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Group mb="md" justify="space-between" align="flex-start" onClick={(e) => e.stopPropagation()}>
          <Group gap="sm" style={{ flex: 1 }}>
            <TextInput
              placeholder={t('skills.skills.searchPlaceholder')}
              value={searchKey}
              onChange={(e) => setSearchKey(e.currentTarget.value)}
              leftSection={<IconSearch size={14} />}
              style={{ flex: 1, maxWidth: 300 }}
              size="xs"
            />
            {availableSources.length > 1 && (
              <SegmentedControl
                size="xs"
                value={sourceFilter}
                onChange={setSourceFilter}
                data={[
                  { value: 'all', label: t('skills.skills.filterAll') },
                  ...availableSources.map((s) => ({ value: s, label: s })),
                ]}
              />
            )}
          </Group>
          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<IconFolderPlus size={14} />}
            onClick={(e) => { e.stopPropagation(); setShowImportModal(true); }}
          >
            {t('skills.skills.importBtn')}
          </Button>
        </Group>

        {filteredSkills.length === 0 && !loading ? (
          <Box py={48} style={{ textAlign: 'center' }}>
            <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="md">
              <IconSparkles size={24} />
            </ThemeIcon>
            <Text c="dimmed" size="sm">
              {searchKey || sourceFilter !== 'all' ? t('skills.skills.noMatches') : t('skills.skills.noSkills')}
            </Text>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {filteredSkills.map((skill) => (
              <Box
                key={skill.name}
                p="md"
                onClick={(e) => { e.stopPropagation(); setSelectedSkill(skill); }}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${selectedSkill?.name === skill.name ? 'var(--mantine-color-teal-4)' : 'var(--flock-border-subtle)'}`,
                  background: selectedSkill?.name === skill.name ? 'var(--flock-accent-soft)' : 'var(--flock-bg-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                className="hover-card-lift"
              >
                <Group gap="sm" mb="sm">
                  <ThemeIcon size={36} radius="md" variant="light" color="teal">
                    <IconSparkles size={20} />
                  </ThemeIcon>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate style={{ color: 'var(--flock-text-bright)' }}>
                      {skill.display_name || skill.name}
                    </Text>
                  </Box>
                </Group>

                <Box mb="sm" style={{ minHeight: 36 }}>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {skill.description || t('skills.skills.noDescription')}
                  </Text>
                </Box>

                <Group justify="space-between">
                  <Group gap={6}>
                    <Badge size="xs" variant="light" color={SOURCE_COLORS[skill.source] || 'gray'} radius="sm">
                      {skill.source}
                    </Badge>
                    {skill.user_invocable && (
                      <Badge size="xs" variant="light" color="cyan" radius="sm">
                        {t('skills.skills.invocableBadge')}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t('skills.skills.characters', { count: skill.content_length })}
                  </Text>
                </Group>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>

      {selectedSkill && (
        <SkillDetailPanel
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      <ExtraDirsModal
        opened={showImportModal}
        onClose={() => setShowImportModal(false)}
        onUpdate={fetchSkills}
      />
    </Box>
  );
}
