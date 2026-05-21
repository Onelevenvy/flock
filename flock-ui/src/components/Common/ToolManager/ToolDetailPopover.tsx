import { useState } from 'react';
import { Box, Text, Group, Badge, Stack, Popover, Divider, Tooltip, ActionIcon } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { Tool, ToolProvider } from '../../../hooks/useAvailableTools';
import { ToolsIcon } from '../Icons';
import { getProviderName } from '../../../pages/Skills/helpers';


interface ToolDetailPopoverProps {
  tool: Tool;
  provider?: ToolProvider;
}

function parseParams(inputSchema: string): Record<string, { type: string; description: string }> {
  try {
    return JSON.parse(inputSchema)?.properties ?? {};
  } catch {
    return {};
  }
}

export function ToolDetailPopover({ tool, provider }: ToolDetailPopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const params = parseParams(tool.input_schema);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={300}
      withinPortal
      position="right"
      middlewares={{ flip: true, shift: true }}
      shadow="md"
      styles={{
        dropdown: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
          borderRadius: 12,
          padding: 0,
          zIndex: 9999,
          maxHeight: 'min(480px, 80vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Popover.Target>
        <Tooltip label={t('workflow.properties.agent.toolDetail')} withinPortal>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            onClick={(e) => { e.stopPropagation(); setOpened((o) => !o); }}
          >
            <IconInfoCircle size={13} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <Group gap="sm" p="md" pb="sm">
          <Box
            style={{
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
              background: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-subtle)',
              flexShrink: 0,
            }}
          >
            <ToolsIcon name={tool.provider_id} size={18} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            {provider && (
              <Text
                size="9px" fw={600} tt="uppercase"
                style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.06em', lineHeight: 1 }}
              >
                {getProviderName(provider)}
              </Text>
            )}
            <Text
              size="sm" fw={600}
              style={{ color: 'var(--flock-text-bright)', fontFamily: 'var(--mantine-font-family-monospace)' }}
            >
              {tool.name}
            </Text>
          </Box>
        </Group>

        <Divider color="var(--flock-border-subtle)" />

        <Box p="md" style={{ flex: 1, overflowY: 'auto' }}>
          <Text size="xs" c="dimmed" mb={Object.keys(params).length > 0 ? 'md' : 0} style={{ lineHeight: 1.5 }}>
            {tool.description || t('workflow.properties.agent.noDescription')}
          </Text>

          {Object.keys(params).length > 0 && (
            <>
              <Text size="xs" fw={600} mb="xs" style={{ color: 'var(--flock-text-secondary)' }}>
                {t('workflow.properties.agent.toolParameters')}
              </Text>
              <Stack gap={5}>
                {Object.entries(params).map(([name, param]) => (
                  <Box
                    key={name}
                    p={8}
                    style={{
                      borderRadius: 6,
                      background: 'var(--flock-bg-surface)',
                      border: '1px solid var(--flock-border-subtle)',
                    }}
                  >
                    <Group justify="space-between" mb={3}>
                      <Text
                        size="xs" fw={500}
                        style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'var(--flock-text-bright)' }}
                      >
                        {name}
                      </Text>
                      <Badge size="xs" variant="filled" color="blue">
                        {param.type || 'any'}
                      </Badge>
                    </Group>
                    {param.description && (
                      <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {param.description}
                      </Text>
                    )}
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
