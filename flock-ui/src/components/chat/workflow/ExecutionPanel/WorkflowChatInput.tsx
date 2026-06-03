import { Box, Text } from '@mantine/core';
import { ChatInput } from '@/components/chat/shared/ChatInput';
import { useTranslation } from 'react-i18next';

interface WorkflowChatInputProps {
  isInterrupted: boolean;
  status: string;
  inputVal: string;
  setInputVal: (val: string) => void;
  handleStart: () => void;
  stopWorkflow: () => void;
}

export function WorkflowChatInput({
  isInterrupted,
  status,
  inputVal,
  setInputVal,
  handleStart,
  stopWorkflow,
}: WorkflowChatInputProps) {
  const { t } = useTranslation();

  const isStreaming = status === 'running';
  const canSend = inputVal.trim().length > 0 && status !== 'running';

  const placeholder = isStreaming
    ? t('chat.agentThinking')
    : t('chat.inputPlaceholderShort');

  return (
    <Box
      style={{
        background: 'var(--flock-bg-surface)',
        padding: '12px 16px 14px',
        flexShrink: 0,
        width: '100%',
      }}
    >
      <ChatInput
        value={inputVal}
        onChange={setInputVal}
        onSend={handleStart}
        onStop={stopWorkflow}
        isStreaming={isStreaming}
        disabled={status === 'running'}
        placeholder={placeholder}
        isInterrupted={isInterrupted}
        interruptedMessage={t('workflow.execution.waitingHint', 'Waiting for your selection above...')}
        leftExtra={
          inputVal.length > 0 ? (
            <Text size="xs" style={{ color: 'var(--flock-text-dim)', fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {inputVal.length} {t('chat.characterCount')}
            </Text>
          ) : undefined
        }
        rightExtra={
          canSend && (
            <Text size="xs" style={{ color: 'var(--flock-text-dim)', opacity: 0.8, fontSize: 11, whiteSpace: 'nowrap' }}>
              {t('chat.enterToSend')}
            </Text>
          )
        }
        sendLabel={canSend ? t('chat.sendEnter') : placeholder}
        stopLabel={t('common.stop', 'Stop responding')}
      />

      <Text size="xs" style={{ color: 'var(--flock-text-dim)', textAlign: 'center', opacity: 0.8, fontSize: 11 }} mt={6}>
        {t('chat.disclaimer')}
      </Text>
    </Box>
  );
}
