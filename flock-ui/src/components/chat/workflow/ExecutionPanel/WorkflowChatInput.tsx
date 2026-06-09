import { Box, Text } from '@mantine/core';
import { ChatInput } from '@/components/chat/shared/ChatInput';
import { useTranslation } from 'react-i18next';
import { useChatAttachments } from '@/hooks/useChatAttachments';

interface WorkflowChatInputProps {
  isInterrupted: boolean;
  status: string;
  inputVal: string;
  setInputVal: (val: string) => void;
  handleStart: (text: string, attachments?: any[]) => void;
  stopWorkflow: () => void;
  fileInputEnabled?: boolean;
  imageInputEnabled?: boolean;
  maxFileCount?: number;
}

export function WorkflowChatInput({
  isInterrupted,
  status,
  inputVal,
  setInputVal,
  handleStart,
  stopWorkflow,
  fileInputEnabled = false,
  imageInputEnabled = false,
  maxFileCount = 5,
}: WorkflowChatInputProps) {
  const { t } = useTranslation();

  const {
    attachments,
    addFile,
    removeFile,
    clearFiles,
    isUploading,
  } = useChatAttachments({
    allow_file_upload: fileInputEnabled,
    allow_image_upload: imageInputEnabled,
    max_file_count: maxFileCount,
    max_file_size_mb: 10,
    allowed_mime_types: [],
  });

  const isStreaming = status === 'running';
  const canSend = (inputVal.trim().length > 0 || attachments.length > 0) && status !== 'running';

  const placeholder = isStreaming
    ? t('chat.agentThinking')
    : t('chat.inputPlaceholderShort');

  const onSend = () => {
    handleStart(
      inputVal,
      attachments.map(att => ({
        id: att.id,
        kind: att.kind,
        name: att.name,
        mime_type: att.mime_type,
        size: att.size,
        data_base64: att.data_base64 || null,
      }))
    );
    clearFiles();
  };

  return (
    <Box
      style={{
        background: 'var(--flock-bg-surface)',
        padding: '12px 16px 14px',
        flexShrink: 0,
        width: '100%',
        // Ensure this container creates its own stacking context so the Stop button
        // inside ChatInput is not blocked by compositing layers from sibling ScrollArea
        // or ancestor overflow:hidden containers on macOS WebKit.
        position: 'relative',
        zIndex: 1,
      }}
    >
      <ChatInput
        value={inputVal}
        onChange={setInputVal}
        onSend={onSend}
        onStop={stopWorkflow}
        isStreaming={isStreaming}
        disabled={status === 'running' || isUploading}
        placeholder={placeholder}
        isInterrupted={isInterrupted}
        interruptedMessage={t('workflow.execution.waitingHint', 'Waiting for your selection above...')}
        attachments={attachments}
        onAddFile={addFile}
        onRemoveFile={removeFile}
        allowFileUpload={fileInputEnabled}
        allowImageUpload={imageInputEnabled}
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

