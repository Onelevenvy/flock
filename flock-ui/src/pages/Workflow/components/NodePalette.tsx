import { Box, Text, Divider, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '../nodeConfig';

// Nodes that can be dragged onto canvas (start/end are pre-placed)
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

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    e.dataTransfer.setData('application/workflow-node', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box
      style={{
        width: 74,
        flexShrink: 0,
        borderRight: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '6px 0',
      }}
    >
      <Text
        size="xs"
        ta="center"
        style={{
          color: 'var(--flock-text-muted)',
          fontSize: 9,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '4px 0 5px',
          fontWeight: 600,
        }}
      >
        {t('workflow.palette.title')}
      </Text>
      <Divider color="var(--flock-border-subtle)" mb={4} />

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 5px' }}>
        {PALETTE_NODES.map((type) => {
          const cfg = nodeConfig[type];
          const Icon = cfg.icon;
          return (
            <Tooltip
              key={type}
              label={t(cfg.displayKey, { defaultValue: cfg.display })}
              position="right"
              withArrow
              openDelay={200}
            >
              <div
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '7px 4px',
                  borderRadius: 8,
                  cursor: 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--flock-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: `${cfg.colorHex}16`,
                    border: `1.5px solid ${cfg.colorHex}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} stroke={1.7} style={{ color: cfg.colorHex }} />
                </Box>
                <Text
                  size="xs"
                  ta="center"
                  style={{
                    fontSize: 9,
                    color: 'var(--flock-text-dim)',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {cfg.display}
                </Text>
              </div>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
