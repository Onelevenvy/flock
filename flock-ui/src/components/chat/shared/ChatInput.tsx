import { useRef, KeyboardEvent } from 'react';
import { Box, Group, Button, Textarea, Tooltip, ActionIcon, Text } from '@mantine/core';
import { IconSend, IconPlayerStop } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

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
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
      }
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
          <Textarea
            ref={textareaRef}
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
              },
            }}
          />

          <Group justify="space-between" mt={6} wrap="nowrap" style={{ width: '100%' }}>
            <Group gap={8} wrap="nowrap" style={{ flexShrink: 1, minWidth: 0 }}>
              {leftExtra}
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
