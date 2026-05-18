import { Box, Tabs, Text, Group } from '@mantine/core';
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
      }}
    >
      <Group gap="sm" px="xl" pt="md" pb="sm">
        <IconBolt size={22} color="var(--flock-accent)" />
        <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
          {t('skills.title')}
        </Text>
      </Group>

      <Tabs defaultValue="tools" px="xl" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Tabs.List>
          <Tabs.Tab value="tools" leftSection={<IconTool size={14} />}>
            Tools
          </Tabs.Tab>
          <Tabs.Tab value="mcp" leftSection={<IconPlug size={14} />}>
            MCP
          </Tabs.Tab>
          <Tabs.Tab value="skills" leftSection={<IconSparkles size={14} />}>
            Skills
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
