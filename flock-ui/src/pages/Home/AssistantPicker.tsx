import { Group, UnstyledButton, Avatar, Text, Box } from '@mantine/core';
import { type Assistant } from '../../types/assistant';
import { useAssistantsQuery } from '../../hooks/useAssistants';

// ---- 内置 XiaoF agent ----
export const XIAOF_AGENT: Assistant = {
  id: '__xiaof__',
  name: 'XiaoF',
  icon: '🤖',
  description: '通用 AI 助手，拥有所有工具 and 技能',
  model: '',
  system_prompt: '',
  tools: [],
  skills: [],
  is_builtin: true,
  sort_order: -1,
  created_at: '',
  updated_at: '',
};

export function AssistantPicker({
  selected,
  onSelect,
}: {
  selected: Assistant;
  onSelect: (a: Assistant) => void;
}) {
  const { data: assistants = [] } = useAssistantsQuery();
  const allAgents = [XIAOF_AGENT, ...assistants];

  return (
    <Group gap={6} justify="center" wrap="wrap">
      {allAgents.map(a => {
        const isActive = a.id === selected.id;
        return (
          <UnstyledButton
            key={a.id}
            onClick={() => onSelect(a)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px 5px 8px',
              borderRadius: 20,
              border: isActive
                ? '1.5px solid var(--mantine-color-indigo-4)'
                : '1.5px solid var(--flock-border-dim)',
              background: isActive ? 'var(--flock-accent-soft)' : 'var(--flock-bg-raised)',
              color: isActive ? 'var(--mantine-color-indigo-4)' : 'var(--flock-text-dim)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.18s ease',
              boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.18)' : 'none',
            }}
          >
            <Avatar
              size={22}
              radius="xl"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                  : 'var(--flock-bg-surface)',
                fontSize: 13,
                border: '1px solid transparent',
              }}
            >
              {a.icon}
            </Avatar>
            <Text size="xs" fw={isActive ? 600 : 400}>{a.name}</Text>
            {isActive && (
              <Box
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--mantine-color-indigo-4)',
                  marginLeft: 2,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            )}
          </UnstyledButton>
        );
      })}
    </Group>
  );
}
