import { useState, useMemo } from 'react';
import { Box, Text, TextInput, UnstyledButton, Tooltip, Accordion, Group, Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconSearch, IconPuzzle, IconLock } from '@tabler/icons-react';
import { nodeConfig, type NodeType } from '../nodeConfig';
import { useAvailableTools } from '../../../hooks/useAvailableTools';
import { ToolsIcon } from '../../../components/Common/Icons';
import { getProviderName } from '../../Skills/helpers';

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
  onAddNode: (type: NodeType, toolName?: string) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'nodes' | 'tools'>('nodes');
  const [searchQuery, setSearchQuery] = useState('');

  const { tools = [], providers = [] } = useAvailableTools();

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, nodeType: NodeType, toolName?: string) => {
    e.dataTransfer.setData('application/workflow-node', nodeType);
    if (toolName) {
      e.dataTransfer.setData('application/workflow-tool-name', toolName);
    }
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

  const filteredProviders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return providers
      .map((prov) => {
        const provTools = tools.filter((t) => t.provider_id === prov.id);
        const matched = provTools.filter((tool) =>
          !q || tool.name.toLowerCase().includes(q) || getProviderName(prov).toLowerCase().includes(q)
        );
        return { ...prov, tools: matched };
      })
      .filter((prov) => prov.tools.length > 0);
  }, [providers, tools, searchQuery]);

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
        <Tooltip
          label={t('workflow.palette.comingSoon', 'Coming soon')}
          position="top"
          withArrow
        >
          <UnstyledButton
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--flock-text-muted)',
              borderBottom: '2px solid transparent',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            {t('workflow.palette.tabTools', 'Tools')}
          </UnstyledButton>
        </Tooltip>
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
        <>
          {/* Search Box */}
          <Box style={{ padding: 10 }}>
            <TextInput
              size="xs"
              placeholder={t('workflow.palette.searchToolsPlaceholder', 'Search tools...')}
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

          {/* Tools List */}
          <Box style={{ flex: 1, overflowY: 'auto', padding: '0 8px 10px' }}>
            {filteredProviders.length > 0 ? (
              <Accordion
                multiple
                defaultValue={filteredProviders.map((p) => p.id)}
                styles={{
                  item: { border: 'none', background: 'var(--flock-bg-surface)', marginBottom: 4, borderRadius: 8, overflow: 'hidden' },
                  control: { padding: '6px 8px' },
                  content: { padding: '0 8px 6px 8px' },
                }}
              >
                {filteredProviders.map((provider) => (
                  <Accordion.Item key={provider.id} value={provider.id}>
                    <Accordion.Control>
                      <Group gap="xs">
                        <ToolsIcon name={provider.icon || provider.id} size={14} style={{ flexShrink: 0 }} />
                        <Text fw={600} size="xs" style={{ color: 'var(--flock-text-bright)' }}>
                          {getProviderName(provider)}
                        </Text>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Box style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {provider.tools.map((tool) => {
                          const isUnauthorized = provider.credentials_schema && !provider.is_available;
                          return (
                            <div
                              key={tool.id}
                              draggable={!isUnauthorized}
                              onDragStart={(e) => {
                                if (isUnauthorized) {
                                  e.preventDefault();
                                  return;
                                }
                                onDragStart(e, 'plugin', tool.name);
                              }}
                              onClick={() => !isUnauthorized && onAddNode('plugin', tool.name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 8px',
                                borderRadius: 6,
                                cursor: isUnauthorized ? 'not-allowed' : 'grab',
                                userSelect: 'none',
                                opacity: isUnauthorized ? 0.55 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isUnauthorized) {
                                  (e.currentTarget as HTMLElement).style.background = 'var(--flock-bg-hover)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isUnauthorized) {
                                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }
                              }}
                            >
                              <Group justify="space-between" align="center" style={{ width: '100%' }}>
                                <Text
                                  size="xs"
                                  fw={500}
                                  style={{
                                    color: 'var(--flock-text-dim)',
                                    lineHeight: 1.3,
                                    fontFamily: 'var(--mantine-font-family-monospace)',
                                  }}
                                >
                                  {tool.name}
                                </Text>
                                {isUnauthorized && (
                                  <Badge
                                    size="xs"
                                    color="red"
                                    variant="light"
                                    leftSection={<IconLock size={8} />}
                                    styles={{ root: { padding: '0 4px', height: 16 } }}
                                  >
                                    {t('assistant.form.unauthorized', '未授权')}
                                  </Badge>
                                )}
                              </Group>
                            </div>
                          );
                        })}
                      </Box>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            ) : (
              <Text size="xs" ta="center" c="dimmed" py="xl">
                {t('workflow.palette.noToolsResults', 'No tools found')}
              </Text>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
