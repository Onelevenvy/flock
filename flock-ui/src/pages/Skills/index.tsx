import { Box, Tabs, Text, Group, ThemeIcon, Divider } from '@mantine/core';
import { IconBolt, IconTool, IconSparkles, IconPlug } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ToolsTab } from './ToolsTab';
import { McpTab } from './McpTab';
import { SkillsTab } from './SkillsTab';

export function SkillsPage() {
  const { t } = useTranslation();

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: 'var(--flock-bg-base)',
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
      </Group>

      <Divider color="var(--flock-border-subtle)" />

      <Tabs defaultValue="tools" px="xl" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Tabs.List>
          <Tabs.Tab value="tools" leftSection={<IconTool size={14} />}>
            {t('skills.tabTools')}
          </Tabs.Tab>
          <Tabs.Tab value="mcp" leftSection={<IconPlug size={14} />}>
            {t('skills.tabMcp')}
          </Tabs.Tab>
          <Tabs.Tab value="skills" leftSection={<IconSparkles size={14} />}>
            {t('skills.tabSkills')}
          </Tabs.Tab>
        </Tabs.List>

        <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0 }} pt="md" pb="md">
          <Tabs.Panel value="tools" style={{ height: '100%' }}>
            <ToolsTab />
          </Tabs.Panel>
          <Tabs.Panel value="mcp" style={{ height: '100%' }}>
            <McpTab />
          </Tabs.Panel>
          <Tabs.Panel value="skills" style={{ height: '100%' }}>
            <SkillsTab />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  );
}
