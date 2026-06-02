import { Box } from '@mantine/core';
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

  return (
    <Box p="xs" style={{ background: 'var(--flock-bg-surface)', width: '100%' }}>
      <ChatInput
        value={inputVal}
        onChange={setInputVal}
        onSend={handleStart}
        onStop={stopWorkflow}
        isStreaming={status === 'running'}
        disabled={status === 'running'}
        placeholder={t('workflow.execution.inputPlaceholder', 'Enter initial query...')}
        isInterrupted={isInterrupted}
        interruptedMessage={t('workflow.execution.waitingHint', 'Waiting for your selection above...')}
        sendLabel={t('workflow.execution.run', 'Send')}
        stopLabel={t('common.stop', 'Stop responding')}
      />
    </Box>
  );
}
