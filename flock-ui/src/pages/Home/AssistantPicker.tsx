import { Group, UnstyledButton, Avatar, Text, Box, Menu } from '@mantine/core';
import { IconSparkles, IconRoute, IconDots } from '@tabler/icons-react';
import i18next from 'i18next';
import { type Assistant } from '@/types/assistant';
import { useAssistantsQuery } from '@/hooks/useAssistants';
import { useWorkflowsQuery, type WorkflowRecord } from '@/hooks/useWorkflow';
import { useTranslation } from 'react-i18next';

// ---- 内置 XiaoF agent ----
export const XIAOF_AGENT: Assistant = {
  id: '__xiaof__',
  name: 'XiaoF',
  icon: '🤖',
  description: i18next.t('home:xiaofDescription'),
  model: '',
  system_prompt: '',
  tools: [],
  skills: [],
  disabled_tools: [],
  is_builtin: true,
  sort_order: -1,
  created_at: '',
  updated_at: '',
  input_config: '{}',
};

export function AssistantPicker({
  selectedType,
  selectedId,
  onSelect,
}: {
  selectedType: 'assistant' | 'workflow';
  selectedId: string;
  onSelect: (type: 'assistant' | 'workflow', id: string, item: Assistant | WorkflowRecord | null) => void;
}) {
  const { t } = useTranslation();
  const { data: assistants = [] } = useAssistantsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();

  const allAssistants = [XIAOF_AGENT, ...assistants];

  // Helper to switch type
  const handleTypeChange = (newType: 'assistant' | 'workflow') => {
    if (newType === selectedType) return;
    if (newType === 'assistant') {
      const defaultAsst = allAssistants[0];
      onSelect('assistant', defaultAsst.id, defaultAsst);
    } else {
      const defaultWf = workflows.filter(w => !!w.active_version)[0];
      if (defaultWf) {
        onSelect('workflow', defaultWf.id, defaultWf);
      } else {
        onSelect('workflow', '', null);
      }
    }
  };

  // Determine current items list based on selectedType
  const currentItems = selectedType === 'assistant' 
    ? allAssistants.map(a => ({ id: a.id, name: a.name, icon: a.icon, raw: a }))
    : workflows.filter(w => !!w.active_version).map(w => ({ id: w.id, name: w.name, icon: '⚡', raw: w }));

  // Apply max-5 rule with ellipsis
  const getVisibleItems = (items: typeof currentItems, activeId: string) => {
    if (items.length <= 5) return { visible: items, remaining: [] };
    const selectedIdx = items.findIndex(item => item.id === activeId);
    if (selectedIdx >= 5) {
      const visible = [...items.slice(0, 4), items[selectedIdx]];
      const remaining = items.filter((_, idx) => idx !== selectedIdx && idx >= 4);
      return { visible, remaining };
    }
    return {
      visible: items.slice(0, 5),
      remaining: items.slice(5)
    };
  };

  const { visible, remaining } = getVisibleItems(currentItems, selectedId);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      {/* 模式选择切换栏 (Pill Segmented Control) */}
      <Group
        gap={4}
        style={{
          background: 'var(--flock-bg-raised)',
          padding: 4,
          borderRadius: 24,
          border: '1.5px solid var(--flock-border-dim)',
          display: 'inline-flex',
        }}
      >
        <UnstyledButton
          onClick={() => handleTypeChange('assistant')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 18px',
            borderRadius: 20,
            background: selectedType === 'assistant' ? 'var(--flock-accent-soft)' : 'transparent',
            color: selectedType === 'assistant' ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
            fontSize: 13,
            fontWeight: selectedType === 'assistant' ? 600 : 500,
            transition: 'all 0.18s ease',
          }}
        >
          <IconSparkles size={14} />
          <Text size="xs" fw={selectedType === 'assistant' ? 600 : 500}>
            {t('home.aiAssistants', '智能助手')}
          </Text>
        </UnstyledButton>

        <UnstyledButton
          onClick={() => handleTypeChange('workflow')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 18px',
            borderRadius: 20,
            background: selectedType === 'workflow' ? 'var(--flock-accent-soft)' : 'transparent',
            color: selectedType === 'workflow' ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
            fontSize: 13,
            fontWeight: selectedType === 'workflow' ? 600 : 500,
            transition: 'all 0.18s ease',
          }}
        >
          <IconRoute size={14} />
          <Text size="xs" fw={selectedType === 'workflow' ? 600 : 500}>
            {t('home.workflows', '工作流')}
          </Text>
        </UnstyledButton>
      </Group>

      {/* 选项展示列表 */}
      {currentItems.length === 0 ? (
        <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', margin: '4px 0' }}>
          {selectedType === 'workflow' ? t('workflow.emptyTitle', '暂无可用工作流') : ''}
        </Text>
      ) : (
        <Group gap={6} justify="center" wrap="wrap">
          {visible.map(item => {
            const isActive = item.id === selectedId;
            return (
              <UnstyledButton
                key={item.id}
                onClick={() => onSelect(selectedType, item.id, item.raw)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 14px 5px 8px',
                  borderRadius: 20,
                  border: isActive
                    ? '1.5px solid var(--flock-accent)'
                    : '1.5px solid var(--flock-border-dim)',
                  background: isActive ? 'var(--flock-accent-soft)' : 'var(--flock-bg-raised)',
                  color: isActive ? 'var(--flock-accent)' : 'var(--flock-text-secondary)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(21, 90, 239, 0.18)' : 'none',
                }}
              >
                <Avatar
                  size={22}
                  radius="xl"
                  style={{
                    background: isActive
                      ? 'var(--flock-accent)'
                      : 'var(--flock-bg-surface)',
                    fontSize: 13,
                    border: '1px solid transparent',
                  }}
                >
                  {item.icon}
                </Avatar>
                <Text size="xs" fw={isActive ? 600 : 500}>{item.name}</Text>
                {isActive && (
                  <Box
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--flock-accent)',
                      marginLeft: 2,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                )}
              </UnstyledButton>
            );
          })}

          {/* 更多按钮 */}
          {remaining.length > 0 && (
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <UnstyledButton
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 14px 5px 8px',
                    borderRadius: 20,
                    border: '1.5px dashed var(--flock-border-dim)',
                    background: 'transparent',
                    color: 'var(--flock-text-secondary)',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.18s ease',
                  }}
                >
                  <Avatar size={22} radius="xl" style={{ background: 'var(--flock-bg-surface)', fontSize: 13 }}>
                    <IconDots size={14} />
                  </Avatar>
                  <Text size="xs">{t('home.more', '更多...')}</Text>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                {remaining.map(item => (
                  <Menu.Item
                    key={item.id}
                    leftSection={
                      <Avatar size={18} radius="xl" style={{ background: 'transparent', fontSize: 11 }}>
                        {item.icon}
                      </Avatar>
                    }
                    onClick={() => onSelect(selectedType, item.id, item.raw)}
                  >
                    {item.name}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      )}
    </Box>
  );
}
