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
  Badge,
  Group,
} from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { getAvailableVariables } from './helper';
import { TYPE_BADGES, TYPE_COLORS, type VariableType } from '../../../../types/workflowVariables';

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
  const environmentVariables = useWorkflowStore((s) => s.environmentVariables);

  const variables = useMemo(
    () => getAvailableVariables(currentNodeId, nodes, edges, environmentVariables),
    [currentNodeId, nodes, edges, environmentVariables]
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
              <Tooltip label={t('workflow.properties.insertVar')} position="top">
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
      <Popover.Dropdown p="xs" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)', minWidth: 260, maxHeight: 280, overflowY: 'auto' }}>
        <Text size="xs" fw={500} mb="xs" c="dimmed" style={{ paddingLeft: 6 }}>
          {t('workflow.properties.selectParameter', 'Select antecedent output parameter')}
        </Text>
        <Stack gap="sm">
          {Object.entries(groupedVars).map(([nodeName, vars]) => (
            <Box key={nodeName}>
              <Text size="xs" fw={600} c="dimmed" mb={4} style={{ paddingLeft: 6, fontSize: 10, textTransform: 'uppercase' }}>
                {nodeName}
              </Text>
              <Stack gap={1}>
                {vars.map((v) => {
                  const varPath = v.value.substring(2, v.value.length - 1);
                  const displayVarName = v.nodeId === 'sys' ? varPath : varPath.split('.')[1] || varPath;
                  
                  let prefixSymbol = <span style={{ color: '#228be6', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>(x)</span>;
                  if (v.varType === 'number') {
                    prefixSymbol = <span style={{ color: '#0ca678', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>[#]</span>;
                  } else if (v.varType === 'boolean') {
                    prefixSymbol = <span style={{ color: '#fd7e14', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>[?]</span>;
                  } else if (v.nodeId === 'sys') {
                    prefixSymbol = <span style={{ color: '#fd7e14', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>{`{x}`}</span>;
                  }
                  
                  const typeLabel = v.varType ? v.varType.charAt(0).toUpperCase() + v.varType.slice(1) : '';

                  return (
                    <Button
                      key={v.value}
                      size="xs"
                      variant="subtle"
                      justify="flex-start"
                      onClick={() => insertVariable(v.value)}
                      styles={{
                        root: {
                          height: 28,
                          padding: '4px 8px',
                          color: 'var(--flock-text-bright)',
                          borderRadius: 6,
                          '&:hover': {
                            backgroundColor: 'var(--flock-bg-raised, rgba(0,0,0,0.05))',
                          }
                        },
                        inner: {
                          justifyContent: 'flex-start',
                          width: '100%',
                        }
                      }}
                    >
                      <Group gap={0} style={{ width: '100%' }} align="center">
                        {prefixSymbol}
                        <Text size="xs" fw={500} style={{ color: 'var(--flock-text-bright)' }}>
                          {displayVarName}
                        </Text>
                        <Text size="10px" c="dimmed" ml="auto" style={{ fontSize: 10 }}>
                          {typeLabel}
                        </Text>
                      </Group>
                    </Button>
                  );
                })}
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
  const environmentVariables = useWorkflowStore((s) => s.environmentVariables);

  const variables = useMemo(
    () => getAvailableVariables(currentNodeId, nodes, edges, environmentVariables),
    [currentNodeId, nodes, edges, environmentVariables]
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
              <Tooltip label={t('workflow.properties.insertVar')} position="top">
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
      <Popover.Dropdown p="xs" style={{ background: 'var(--flock-bg-surface)', border: '1px solid var(--flock-border-subtle)', minWidth: 260, maxHeight: 280, overflowY: 'auto' }}>
        <Text size="xs" fw={500} mb="xs" c="dimmed" style={{ paddingLeft: 6 }}>
          {t('workflow.properties.selectParameter', 'Select antecedent output parameter')}
        </Text>
        <Stack gap="sm">
          {Object.entries(groupedVars).map(([nodeName, vars]) => (
            <Box key={nodeName}>
              <Text size="xs" fw={600} c="dimmed" mb={4} style={{ paddingLeft: 6, fontSize: 10, textTransform: 'uppercase' }}>
                {nodeName}
              </Text>
              <Stack gap={1}>
                {vars.map((v) => {
                  const varPath = v.value.substring(2, v.value.length - 1);
                  const displayVarName = v.nodeId === 'sys' ? varPath : varPath.split('.')[1] || varPath;
                  
                  let prefixSymbol = <span style={{ color: '#228be6', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>(x)</span>;
                  if (v.varType === 'number') {
                    prefixSymbol = <span style={{ color: '#0ca678', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>[#]</span>;
                  } else if (v.varType === 'boolean') {
                    prefixSymbol = <span style={{ color: '#fd7e14', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>[?]</span>;
                  } else if (v.nodeId === 'sys') {
                    prefixSymbol = <span style={{ color: '#fd7e14', marginRight: 6, fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>{`{x}`}</span>;
                  }
                  
                  const typeLabel = v.varType ? v.varType.charAt(0).toUpperCase() + v.varType.slice(1) : '';

                  return (
                    <Button
                      key={v.value}
                      size="xs"
                      variant="subtle"
                      justify="flex-start"
                      onClick={() => insertVariable(v.value)}
                      styles={{
                        root: {
                          height: 28,
                          padding: '4px 8px',
                          color: 'var(--flock-text-bright)',
                          borderRadius: 6,
                          '&:hover': {
                            backgroundColor: 'var(--flock-bg-raised, rgba(0,0,0,0.05))',
                          }
                        },
                        inner: {
                          justifyContent: 'flex-start',
                          width: '100%',
                        }
                      }}
                    >
                      <Group gap={0} style={{ width: '100%' }} align="center">
                        {prefixSymbol}
                        <Text size="xs" fw={500} style={{ color: 'var(--flock-text-bright)' }}>
                          {displayVarName}
                        </Text>
                        <Text size="10px" c="dimmed" ml="auto" style={{ fontSize: 10 }}>
                          {typeLabel}
                        </Text>
                      </Group>
                    </Button>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
