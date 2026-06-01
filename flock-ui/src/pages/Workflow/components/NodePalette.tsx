import { useState } from 'react';
import { Box, Text, TextInput, UnstyledButton, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconSearch } from '@tabler/icons-react';
import { nodeConfig, type NodeType } from '../nodeConfig';

// Nodes that can be added onto canvas (start/end are pre-placed)
const PALETTE_NODES: NodeType[] = [
  'llm',
  'agent',
  'human',
  'classifier',
  'answer',
  'parameterExtractor',
  'ifelse',
  'code',
];

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'nodes' | 'tools'>('nodes');
  const [searchQuery, setSearchQuery] = useState('');

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    e.dataTransfer.setData('application/workflow-node', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const filteredNodes = PALETTE_NODES.filter((type) => {
    const cfg = nodeConfig[type];
    if (!cfg) return false;
    const name = t(cfg.displayKey, { defaultValue: cfg.display }).toLowerCase();
    const display = cfg.display.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || display.includes(query);
  });

  return (
    <Box
      style={{
        width: 250,
        height: 380,
        borderRadius: 12,
        border: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <Box
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
          padding: '4px 8px 0',
        }}
      >
        <UnstyledButton
          onClick={() => setActiveTab('nodes')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 0',
            fontSize: 11,
            fontWeight: 700,
            color: activeTab === 'nodes' ? 'var(--flock-accent)' : 'var(--flock-text-muted)',
            borderBottom: activeTab === 'nodes' ? '2px solid var(--flock-accent)' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {t('workflow.palette.tabNodes', 'Nodes')}
        </UnstyledButton>
        <UnstyledButton
          onClick={() => setActiveTab('tools')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 0',
            fontSize: 11,
            fontWeight: 700,
            color: activeTab === 'tools' ? 'var(--flock-accent)' : 'var(--flock-text-muted)',
            borderBottom: activeTab === 'tools' ? '2px solid var(--flock-accent)' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {t('workflow.palette.tabTools', 'Tools')}
        </UnstyledButton>
      </Box>

      {activeTab === 'nodes' ? (
        <>
          {/* Search Box */}
          <Box style={{ padding: 10 }}>
            <TextInput
              size="xs"
              placeholder={t('workflow.palette.searchPlaceholder', 'Search nodes...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={12} style={{ color: 'var(--flock-text-muted)' }} />}
              styles={{
                input: {
                  borderRadius: 6,
                  background: 'var(--flock-bg-base)',
                  border: '1px solid var(--flock-border-subtle)',
                },
              }}
            />
          </Box>

          {/* Node List */}
          <Box style={{ flex: 1, overflowY: 'auto', padding: '0 8px 10px' }}>
            {filteredNodes.length > 0 ? (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredNodes.map((type) => {
                  const cfg = nodeConfig[type];
                  const Icon = cfg.icon;
                  const isDisabled = ['ifelse', 'code', 'parameterExtractor'].includes(type);

                  const item = (
                    <div
                      key={type}
                      draggable={!isDisabled}
                      onDragStart={(e) => {
                        if (isDisabled) {
                          e.preventDefault();
                          return;
                        }
                        onDragStart(e, type);
                      }}
                      onClick={() => !isDisabled && onAddNode(type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: isDisabled ? 'not-allowed' : 'grab',
                        userSelect: 'none',
                        opacity: isDisabled ? 0.45 : 1,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--flock-bg-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisabled) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      <Box
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: `${cfg.colorHex}12`,
                          border: `1px solid ${cfg.colorHex}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={12} stroke={2.5} style={{ color: cfg.colorHex }} />
                      </Box>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          size="xs"
                          fw={600}
                          style={{
                            color: 'var(--flock-text-bright)',
                            lineHeight: 1.2,
                          }}
                        >
                          {t(cfg.displayKey, { defaultValue: cfg.display })}
                        </Text>
                      </Box>
                    </div>
                  );

                  if (isDisabled) {
                    return (
                      <Tooltip
                        key={type}
                        label={t('workflow.palette.comingSoon', 'Coming soon')}
                        position="right"
                        withArrow
                        openDelay={200}
                      >
                        {item}
                      </Tooltip>
                    );
                  }

                  return item;
                })}
              </Box>
            ) : (
              <Text size="xs" ta="center" c="dimmed" py="xl">
                {t('workflow.palette.noResults', 'No nodes found')}
              </Text>
            )}
          </Box>
        </>
      ) : (
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text size="xs" ta="center" c="dimmed">
            {t('workflow.palette.noTools', 'No custom tools configured')}
          </Text>
        </Box>
      )}
    </Box>
  );
}
