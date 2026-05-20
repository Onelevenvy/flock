import { Box, Text, Stack, Divider, UnstyledButton, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from './nodeConfig';

// Node types that can be dragged onto canvas (excludes start/end which are auto-added)
const PALETTE_NODES: NodeType[] = [
  'llm',
  'agent',
  'classifier',
  'ifelse',
  'answer',
  'code',
  'human',
  'parameterExtractor',
  'plugin',
];

export function NodePalette() {
  const { t } = useTranslation();

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/workflow-node', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box
      style={{
        width: 70,
        borderRight: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0',
        gap: 4,
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <Text
        size="xs"
        c="dimmed"
        ta="center"
        style={{ letterSpacing: '0.05em', padding: '4px 0' }}
      >
        {t('workflow.palette.title')}
      </Text>
      <Divider color="var(--flock-border-subtle)" />
      <Stack gap={2} pt={4}>
        {PALETTE_NODES.map((type) => {
          const cfg = nodeConfig[type];
          const Icon = cfg.icon;
          return (
            <Tooltip
              key={type}
              label={t(cfg.displayKey, { defaultValue: cfg.display })}
              position="right"
              withArrow
            >
              <UnstyledButton
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '8px 4px',
                  borderRadius: 8,
                  cursor: 'grab',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    'var(--flock-accent-soft)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: cfg.colorHex + '22',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1.5px solid ${cfg.colorHex}44`,
                  }}
                >
                  <Icon size={18} stroke={1.5} style={{ color: cfg.colorHex }} />
                </Box>
                <Text
                  size="xs"
                  ta="center"
                  lineClamp={1}
                  style={{ fontSize: 9, color: 'var(--flock-text-secondary)', width: '100%' }}
                >
                  {cfg.display}
                </Text>
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
