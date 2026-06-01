import { useState, useCallback } from 'react';
import {
  Box,
  Text,
  SimpleGrid,
  Badge,
  Group,
  LoadingOverlay,
  ThemeIcon,
  ActionIcon,
  ScrollArea,
  TextInput,
  SegmentedControl,
  Button,
  Tooltip,
  Menu,
} from '@mantine/core';
import {
  IconSparkles,
  IconSearch,
  IconFolderPlus,
  IconFolder,
  IconTrash,
  IconDotsVertical,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { SkillInfo } from './types';
import { SOURCE_COLORS } from './helpers';
import { SkillDetailPanel } from './components/SkillDetailPanel';

import { useSkillsQuery } from '@/hooks/useToolQueries';

const cleanPath = (path?: string) => {
  if (!path) return '';
  let cleaned = path;
  if (cleaned.startsWith('\\\\?\\')) {
    cleaned = cleaned.substring(4);
  }
  return cleaned;
};

export function SkillsTab() {

  const { t } = useTranslation();
  const { data: skills = [], isLoading: loadingSkills, refetch: fetchSkills } = useSkillsQuery();
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [searchKey, setSearchKey] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [importing, setImporting] = useState(false);

  const loading = loadingSkills || importing;

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      !searchKey ||
      s.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      s.description.toLowerCase().includes(searchKey.toLowerCase());
    const matchesSource = sourceFilter === 'all' || s.source === sourceFilter;
    return matchesSearch && matchesSource;
  });


  const availableSources = Array.from(new Set(skills.map((s) => s.source))).sort();


  const handleSelectAndAdd = async (isDirectory: boolean) => {
    try {
      const selected = await open({
        directory: isDirectory,
        multiple: false,
        filters: isDirectory ? undefined : [
          { name: 'Skill Archive', extensions: ['zip', 'skill'] }
        ]
      });
      if (selected && typeof selected === 'string') {
        const cleaned = cleanPath(selected);
        const importName = cleaned.split(/[/\\]/).filter(Boolean).pop()?.replace(/\.(zip|skill)$/i, '') || '';
        
        // Check if there is already a skill with this name in existing skills
        const exists = skills.some(s => s.name.toLowerCase() === importName.toLowerCase() || (s.display_name && s.display_name.toLowerCase() === importName.toLowerCase()));
        
        if (exists) {
          const confirm = window.confirm(t('skills.skills.duplicateSkillWarning'));
          if (!confirm) {
            return;
          }
        }

        setImporting(true);
        await invoke<string[]>('add_extra_skill_dir', { path: selected });
        fetchSkills();
        notifications.show({
          title: t('skills.skills.importSuccess'),
          message: t('skills.skills.importSuccessMsg'),
          color: 'teal',
          autoClose: 3000
        });
      }
    } catch (e: any) {
      notifications.show({
        title: t('skills.skills.importFailed'),
        message: String(e),
        color: 'red',
        autoClose: 5000
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveFolder = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke<string[]>('remove_extra_skill_dir', { path });
      fetchSkills();
      notifications.show({
        title: t('skills.skills.removedToast'),
        message: t('skills.skills.removedToastMsg'),
        color: 'teal',
        autoClose: 3000
      });
    } catch (e: any) {
      notifications.show({
        title: t('skills.skills.removeFailed'),
        message: String(e),
        color: 'red',
        autoClose: 5000
      });
    }
  };


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
          <Menu shadow="md" position="bottom-end">
            <Menu.Target>
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconFolderPlus size={14} />}
                loading={importing}
              >
                {t('skills.skills.importBtn')}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconFolder size={14} />} onClick={() => handleSelectAndAdd(true)}>
                {t('skills.skills.importFolderBtn')}
              </Menu.Item>
              <Menu.Item leftSection={<IconFolderPlus size={14} />} onClick={() => handleSelectAndAdd(false)}>
                {t('skills.skills.importZipBtn')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
                  borderRadius: 18,
                  border: `1px solid ${selectedSkill?.name === skill.name ? 'var(--mantine-color-teal-4)' : 'var(--flock-border-subtle)'}`,
                  background: selectedSkill?.name === skill.name ? 'var(--flock-accent-soft)' : 'var(--flock-bg-raised)',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--flock-accent)';
                  e.currentTarget.style.boxShadow = '0 14px 36px rgba(21, 90, 239, 0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = selectedSkill?.name === skill.name ? 'var(--mantine-color-teal-4)' : 'var(--flock-border-subtle)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.05)';
                }}
              >
                <Group gap="sm" mb="sm" wrap="nowrap" justify="space-between" align="center">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon size={46} radius={14} variant="light" color="teal">
                      <IconSparkles size={20} />
                    </ThemeIcon>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate style={{ color: 'var(--flock-text-bright)' }}>
                        {skill.display_name || skill.name}
                      </Text>
                    </Box>
                  </Group>

                  {skill.source === 'User' && (
                    <Menu shadow="md" position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon size="sm" variant="subtle" color="gray" onClick={(e) => e.stopPropagation()}>
                          <IconDotsVertical size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (skill.skill_root) {
                              handleRemoveFolder(skill.skill_root, e);
                            }
                          }}
                        >
                          {t('skills.skills.removeTooltip')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
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
    </Box>
  );
}
