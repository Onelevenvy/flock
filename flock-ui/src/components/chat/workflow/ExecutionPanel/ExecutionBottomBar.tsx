import { Box, Group, TextInput, Button, Text } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ExecutionBottomBarProps {
  isInterrupted: boolean;
  status: string;
  inputVal: string;
  setInputVal: (val: string) => void;
  handleStart: () => void;
}

export function ExecutionBottomBar({
  isInterrupted,
  status,
  inputVal,
  setInputVal,
  handleStart,
}: ExecutionBottomBarProps) {
  const { t } = useTranslation();

  return (
    <Box p="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
      {isInterrupted ? (
        <Text size="xs" c="dimmed" ta="center" style={{ padding: '4px 0' }}>
          ⏳ {t('workflow.execution.waitingHint', 'Waiting for your selection above...')}
        </Text>
      ) : (
        <Group gap="xs">
          <TextInput
            placeholder={t('workflow.execution.inputPlaceholder', 'Enter initial query...')}
            size="xs"
            value={inputVal}
            onChange={(e) => setInputVal(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStart();
            }}
            disabled={status === 'running'}
            style={{ flex: 1 }}
            styles={{
              input: {
                background: 'var(--flock-bg-base)',
                borderColor: 'var(--flock-border-dim)',
              }
            }}
          />
          <Button
            size="xs"
            color="blue"
            onClick={handleStart}
            disabled={!inputVal.trim() || status === 'running'}
            leftSection={<IconSend size={12} />}
          >
            {t('workflow.execution.run', 'Send')}
          </Button>
        </Group>
      )}
    </Box>
  );
}
