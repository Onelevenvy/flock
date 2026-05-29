import { useState, useCallback, useEffect } from 'react';
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
} from '@mantine/core';
import {
  IconSparkles,
  IconSearch,
  IconFolderPlus,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { SkillInfo } from './types';
import { SOURCE_COLORS } from './helpers';
import { SkillDetailPanel } from './components/SkillDetailPanel';
import { ExtraDirsModal } from './components/ExtraDirsModal';

import { useSkillsQuery } from '../../hooks/useToolQueries';

export function SkillsTab() {
  const { t } = useTranslation();
  const { data: skills = [], isLoading: loading, refetch: fetchSkills } = useSkillsQuery();
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [searchKey, setSearchKey] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);

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
