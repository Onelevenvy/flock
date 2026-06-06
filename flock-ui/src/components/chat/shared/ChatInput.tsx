import { useRef, KeyboardEvent } from 'react';
import { Box, Group, Button, Textarea, Tooltip, ActionIcon, Text } from '@mantine/core';
import { IconSend, IconPlayerStop, IconPaperclip, IconPhoto, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export interface ChatAttachment {
  id: string;
  kind: 'image' | 'file';
  name: string;
  mime_type: string;
  size: number;
  data_base64?: string;
}

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  isInterrupted?: boolean;
  interruptedMessage?: string;
  leftExtra?: React.ReactNode;
  rightExtra?: React.ReactNode;
  stopLabel?: string;
  sendLabel?: string;
  
  // Attachments support
  attachments?: ChatAttachment[];
  onAddFile?: (file: File) => void;
  onRemoveFile?: (id: string) => void;
  allowFileUpload?: boolean;
  allowImageUpload?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder,
  isInterrupted = false,
  interruptedMessage,
  leftExtra,
  rightExtra,
  stopLabel,
  sendLabel,
  attachments = [],
  onAddFile,
  onRemoveFile,
  allowFileUpload = false,
  allowImageUpload = false,
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const hasAttachments = attachments && attachments.length > 0;
  const canSend = (value.trim().length > 0 || hasAttachments) && !disabled && !isStreaming;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddFile) {
      onAddFile(file);
      e.target.value = '';
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddFile) {
      onAddFile(file);
      e.target.value = '';
    }
  };

  return (
    <Box style={{ width: '100%', flexShrink: 0 }}>
      {isStreaming && onStop && (
        <Group justify="center" mb="xs">
          <Button
            size="xs"
            variant="default"
            onClick={onStop}
            leftSection={<IconPlayerStop size={14} />}
            style={{
              borderRadius: 100,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              backgroundColor: 'var(--flock-bg-surface)',
              border: '1px solid var(--flock-border-dim)',
              color: 'var(--flock-text-bright)',
            }}
          >
            {stopLabel || t('chat.stopGeneration', 'Stop responding')}
          </Button>
        </Group>
      )}

      {isInterrupted ? (
        <Text size="xs" c="dimmed" ta="center" style={{ padding: '8px 0' }}>
          {interruptedMessage || '⏳ Waiting for your selection above...'}
        </Text>
      ) : (
        <Box
          className="input-bar-wrapper"
          style={{
            background: 'var(--flock-bg-raised)',
            border: '1px solid var(--flock-border-base)',
            borderRadius: 12,
            padding: '8px 12px',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        >
          {/* Attachments Preview */}
          {hasAttachments && (
            <Group gap="xs" mb="xs" wrap="wrap">
              {attachments.map((att) => (
                <Box
                  key={att.id}
                  style={{
                    position: 'relative',
                    background: 'var(--flock-bg-surface)',
                    border: '1px solid var(--flock-border-dim)',
                    borderRadius: 8,
                    padding: att.kind === 'image' ? 0 : '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 48,
                    overflow: 'hidden',
                  }}
                >
                  {att.kind === 'image' && att.data_base64 ? (
                    <img
                      src={att.data_base64}
                      alt={att.name}
                      style={{
                        height: '100%',
                        width: 48,
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <IconPaperclip size={16} style={{ color: 'var(--flock-accent)' }} />
                  )}
                  {att.kind !== 'image' && (
                    <Text size="xs" style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name}
                    </Text>
                  )}
                  <ActionIcon
                    size="xs"
                    color="gray"
                    variant="subtle"
                    onClick={() => onRemoveFile?.(att.id)}
                    style={{
                      position: att.kind === 'image' ? 'absolute' : 'static',
                      top: 2,
                      right: 2,
                      background: att.kind === 'image' ? 'rgba(0,0,0,0.5)' : 'transparent',
                      color: att.kind === 'image' ? '#fff' : 'inherit',
                      borderRadius: '50%',
                    }}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                </Box>
              ))}
            </Group>
          )}

          <Textarea
            ref={textareaRef}
            variant="unstyled"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autosize
            minRows={1}
            maxRows={8}
            styles={{
              input: {
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'var(--flock-text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
                boxShadow: 'none',
                '&::placeholder': {
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              },
            }}
          />

          <Group justify="space-between" mt={6} wrap="nowrap" style={{ width: '100%', height: 32 }}>
            <Group gap={8} wrap="nowrap" style={{ flexShrink: 1, minWidth: 0 }}>
              {leftExtra}

              {/* Paperclip Button */}
              {allowFileUpload && onAddFile && (
                <>
                  <Tooltip label={t('chat.upload.fileBtn', '上传文件')} withArrow>
                    <ActionIcon
                      size="md"
                      variant="subtle"
                      color="gray"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <IconPaperclip size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </>
              )}

              {/* Photo Button */}
              {allowImageUpload && onAddFile && (
                <>
                  <Tooltip label={t('chat.upload.imageBtn', '上传图片')} withArrow>
                    <ActionIcon
                      size="md"
                      variant="subtle"
                      color="gray"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <IconPhoto size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <input
                    type="file"
                    accept="image/*"
                    ref={imageInputRef}
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </>
              )}
            </Group>

            <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
              {rightExtra}

              <Tooltip label={sendLabel || placeholder} withArrow>
                <ActionIcon
                  size="md"
                  color="blue"
                  variant={canSend ? 'filled' : 'subtle'}
                  radius="md"
                  onClick={onSend}
                  disabled={!canSend}
                  style={{
                    transition: 'all 0.15s ease',
                    boxShadow: canSend ? '0 2px 8px rgba(21, 90, 239, 0.3)' : 'none',
                  }}
                >
                  <IconSend size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Box>
      )}
    </Box>
  );
}
