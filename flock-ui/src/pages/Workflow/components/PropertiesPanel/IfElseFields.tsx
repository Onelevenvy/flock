import { Box, Group, Badge, ActionIcon, TextInput, Button, Stack } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { type FieldsProps } from './LLMFields';

export function IfElseFields({ node, onDataChange }: FieldsProps) {
  const { t } = useTranslation();
  const cases = (node.data.cases as { case_id: string; logical_operator: string; conditions: unknown[] }[]) ?? [];

  return (
    <Stack gap="xs">
      {cases.map((c, i) => (
        <Box
          key={c.case_id}
          style={{
            border: '1px solid var(--flock-border-subtle)',
            borderRadius: 8,
            padding: '8px',
          }}
        >
          <Group justify="space-between" mb={4}>
            <Badge size="xs" color={c.case_id === 'false_else' ? 'gray' : 'violet'} variant="light">
              {c.case_id === 'false_else' ? 'ELSE' : `IF ${i + 1}`}
            </Badge>
            {c.case_id !== 'false_else' && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => {
                  const next = cases.filter((_, idx) => idx !== i);
                  onDataChange(node.id, 'cases', next);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
          </Group>
          {c.case_id !== 'false_else' && (
            <TextInput
              placeholder={t('workflow.properties.ifelse.conditionPlaceholder')}
              size="xs"
              value={JSON.stringify(c.conditions)}
              onChange={(e) => {
                try {
                  const next = [...cases];
                  next[i] = { ...c, conditions: JSON.parse(e.target.value) };
                  onDataChange(node.id, 'cases', next);
                } catch {}
              }}
            />
          )}
        </Box>
      ))}
      <Button
        size="xs"
        variant="light"
        leftSection={<IconPlus size={12} />}
        onClick={() => {
          const others = cases.filter((c) => c.case_id === 'false_else');
          const rest = cases.filter((c) => c.case_id !== 'false_else');
          onDataChange(node.id, 'cases', [
            ...rest,
            { case_id: uuidv4(), logical_operator: 'and', conditions: [] },
            ...others,
          ]);
        }}
      >
        {t('workflow.properties.ifelse.addCase')}
      </Button>
    </Stack>
  );
}
