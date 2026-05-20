import { useRef, useState, useMemo } from 'react';
import {
  Box,
  Text,
  ActionIcon,
  TextInput,
  Textarea,
  Button,
  Popover,
  Tooltip,
  Stack,
} from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { getAvailableVariables } from './helper';

export interface VariableTextInputProps extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'onChange'> {
  currentNodeId: string;
  onChange: (val: string) => void;
}

export function VariableTextInput({ currentNodeId, onChange, value, ...props }: VariableTextInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverOpened, setPopoverOpened] = useState(false);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const variables = useMemo(
    () => getAvailableVariables(currentNodeId, nodes, edges),
    [currentNodeId, nodes, edges]
  );

  const insertVariable = (varValue: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const currentText = String(value ?? '');

    const textToInsert = varValue;
    let newStart = start;
    if (start > 0 && currentText[start - 1] === '/') {
      newStart = start - 1;
    }

    const nextText = currentText.substring(0, newStart) + textToInsert + currentText.substring(end);

    onChange(nextText);
    setPopoverOpened(false);

    setTimeout(() => {
      input.focus();
      const nextCursorPos = newStart + textToInsert.length;
      input.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (props.onKeyDown) props.onKeyDown(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '/') {
      setPopoverOpened(true);
    }
  };

  const groupedVars = useMemo(() => {
    const acc: Record<string, typeof variables> = {};
    variables.forEach((v) => {
      (acc[v.nodeName] = acc[v.nodeName] || []).push(v);
    });
    return acc;
  }, [variables]);

  return (
    <Popover
      opened={popoverOpened && variables.length > 0}
      onChange={setPopoverOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <TextInput
          {...props}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          rightSection={
            variables.length > 0 && (
              <Tooltip label={t('workflow.properties.insertVar', { defaultValue: '插入前序变量 (输入 /)' })} position="top">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="blue"
                  onClick={() => setPopoverOpened((o) => !o)}
                  style={{
                    color: popoverOpened ? 'var(--flock-accent)' : 'var(--mantine-color-dimmed)',
                    transition: 'all 0.2s',
                  }}
                >
                  <IconBolt size={14} />
                </ActionIcon>
              </Tooltip>
            )
          }
        />
      </Popover.Target>
      <Popover.Dropdown p="xs" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)', minWidth: 220, maxHeight: 250, overflowY: 'auto' }}>
        <Text size="xs" fw={600} mb="xs" c="dimmed">
          {t('workflow.properties.availableVars', { defaultValue: '选择前序节点输出参数' })}
        </Text>
        <Stack gap={6}>
          {Object.entries(groupedVars).map(([nodeName, vars]) => (
            <Box key={nodeName}>
              <Text size="10px" fw={700} c="dimmed" mb={4} style={{ letterSpacing: '0.5px' }}>
                {nodeName}
              </Text>
              <Stack gap={2}>
                {vars.map((v) => (
                  <Button
                    key={v.value}
                    size="xs"
                    variant="subtle"
                    justify="flex-start"
                    onClick={() => insertVariable(v.value)}
                    styles={{
                      root: {
                        height: 'auto',
                        padding: '4px 6px',
                        textAlign: 'left',
                        color: 'var(--flock-text-bright)',
                      },
                      inner: {
                        justifyContent: 'flex-start',
                      }
                    }}
                  >
                    <Text size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {v.value.substring(2, v.value.length - 1).split('.')[1]}
                    </Text>
                  </Button>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export interface VariableTextareaProps extends Omit<React.ComponentPropsWithoutRef<typeof Textarea>, 'onChange'> {
  currentNodeId: string;
  onChange: (val: string) => void;
}

export function VariableTextarea({ currentNodeId, onChange, value, ...props }: VariableTextareaProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popoverOpened, setPopoverOpened] = useState(false);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const variables = useMemo(
    () => getAvailableVariables(currentNodeId, nodes, edges),
    [currentNodeId, nodes, edges]
  );

  const insertVariable = (varValue: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentText = String(value ?? '');

    const textToInsert = varValue;
    let newStart = start;
    if (start > 0 && currentText[start - 1] === '/') {
      newStart = start - 1;
    }

    const nextText = currentText.substring(0, newStart) + textToInsert + currentText.substring(end);

    onChange(nextText);
    setPopoverOpened(false);

    setTimeout(() => {
      textarea.focus();
      const nextCursorPos = newStart + textToInsert.length;
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (props.onKeyDown) props.onKeyDown(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/') {
      setPopoverOpened(true);
    }
  };

  const groupedVars = useMemo(() => {
    const acc: Record<string, typeof variables> = {};
    variables.forEach((v) => {
      (acc[v.nodeName] = acc[v.nodeName] || []).push(v);
    });
    return acc;
  }, [variables]);

  return (
    <Popover
      opened={popoverOpened && variables.length > 0}
      onChange={setPopoverOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Box style={{ position: 'relative' }}>
          <Textarea
            {...props}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            style={{ width: '100%' }}
          />
          {variables.length > 0 && (
            <div style={{ position: 'absolute', right: 8, top: 4, zIndex: 2 }}>
              <Tooltip label={t('workflow.properties.insertVar', { defaultValue: '插入前序变量 (输入 /)' })} position="top">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="blue"
                  onClick={() => setPopoverOpened((o) => !o)}
                  style={{
                    color: popoverOpened ? 'var(--flock-accent)' : 'var(--mantine-color-dimmed)',
                    transition: 'all 0.2s',
                  }}
                >
                  <IconBolt size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </Box>
      </Popover.Target>
      <Popover.Dropdown p="xs" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)', minWidth: 220, maxHeight: 250, overflowY: 'auto' }}>
        <Text size="xs" fw={600} mb="xs" c="dimmed">
          {t('workflow.properties.availableVars', { defaultValue: '选择前序节点输出参数' })}
        </Text>
        <Stack gap={6}>
          {Object.entries(groupedVars).map(([nodeName, vars]) => (
            <Box key={nodeName}>
              <Text size="10px" fw={700} c="dimmed" mb={4} style={{ letterSpacing: '0.5px' }}>
                {nodeName}
              </Text>
              <Stack gap={2}>
                {vars.map((v) => (
                  <Button
                    key={v.value}
                    size="xs"
                    variant="subtle"
                    justify="flex-start"
                    onClick={() => insertVariable(v.value)}
                    styles={{
                      root: {
                        height: 'auto',
                        padding: '4px 6px',
                        textAlign: 'left',
                        color: 'var(--flock-text-bright)',
                      },
                      inner: {
                        justifyContent: 'flex-start',
                      }
                    }}
                  >
                    <Text size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {v.value.substring(2, v.value.length - 1).split('.')[1]}
                    </Text>
                  </Button>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
