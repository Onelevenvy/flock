import { useState } from 'react';
import { Box, SegmentedControl, Text, Group, ThemeIcon, Divider } from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ToolsTab } from './ToolsTab';
import { McpTab } from './McpTab';
import { SkillsTab } from './SkillsTab';

export function SkillsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'tools' | 'mcp' | 'skills'>('tools');

  return (
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
        position: 'relative',
      }}
    >
      {/* 页头 */}
      <Group gap="sm" px="xl" pt="md" pb="sm" justify="space-between">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" style={{ background: 'var(--flock-accent)' }}>
            <IconBolt size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
              {t('skills.title')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('skills.subtitle')}
            </Text>
          </Box>
        </Group>

        <SegmentedControl
          value={activeTab}
          onChange={(val) => setActiveTab(val as any)}
          data={[
            { value: 'tools', label: t('skills.tabTools') },
            { value: 'mcp', label: t('skills.tabMcp') },
            { value: 'skills', label: t('skills.tabSkills') },
          ]}
          size="xs"
          styles={{
            root: {
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              padding: 2,
              borderRadius: 8,
            },
            control: {
              minWidth: 90,
            }
          }}
        />
      </Group>

      <Divider color="var(--flock-border-subtle)" />

      <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0 }} px="xl" pt="md" pb="md">
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'mcp' && <McpTab />}
        {activeTab === 'skills' && <SkillsTab />}
      </Box>
    </Box>
  );
}
