import { useRef, useState, useMemo, useEffect } from 'react';
import {
  Box,
  Text,
  ActionIcon,
  Popover,
  Tooltip,
  Stack,
  Group,
  Button,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { getAvailableVariables } from './helper';

// --- HTML/Plain text conversion helpers ---
function htmlToPlain(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Replace styled variable tags with their original plain-text representation
  const tags = div.querySelectorAll('.variable-tag');
  tags.forEach(tag => {
    const val = tag.getAttribute('data-val') || '';
    tag.replaceWith(document.createTextNode(val));
  });
  
  // Replace block element tags with newlines to preserve formatting
  const blocks = div.querySelectorAll('p, div, br');
  blocks.forEach(block => {
    if (block.tagName === 'BR') {
      block.replaceWith(document.createTextNode('\n'));
    } else {
      // Append a newline at the end of block elements
      const val = block.innerHTML;
      block.replaceWith(document.createTextNode((block.textContent || '') + '\n'));
    }
  });

  return div.innerText || div.textContent || '';
}

function plainToHtml(text: string, variablesList: any[]): string {
  // Safe HTML escape
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  
  const regex = /\$\{[^}]+\}/g;
  html = html.replace(regex, (match) => {
    const matchedVar = variablesList.find(v => v.value === match);
    const varPath = match.substring(2, match.length - 1);
    const varName = varPath.split('.')[1] || varPath;
    
    // Resolve node group name
    let groupName = 'Start';
    if (match.startsWith('${sys.')) {
      groupName = 'SYSTEM';
    } else if (matchedVar) {
      groupName = matchedVar.nodeName;
    }
    
    const isInvalid = !matchedVar && !match.startsWith('${sys.');
    const bgColor = isInvalid ? 'var(--mantine-color-red-light, #fff0f0)' : 'var(--mantine-color-blue-light, #e8f4fd)';
    const borderColor = isInvalid ? 'var(--mantine-color-red-outline, #ffa8a8)' : 'var(--mantine-color-blue-outline, #cbe4fb)';
    const textColor = isInvalid ? 'var(--mantine-color-red-filled, #fa5252)' : 'var(--mantine-color-blue-filled, #155aef)';
    const icon = isInvalid ? '⚠️' : '🏠';
    
    return `<span class="variable-tag" contenteditable="false" data-val="${match}" style="display: inline-flex; align-items: center; background: ${bgColor}; border: 1px solid ${borderColor}; color: ${textColor}; border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 500; margin: 0 2px; user-select: none; font-family: system-ui; vertical-align: middle;">${icon} ${groupName} / (x) ${varName}</span>`;
  });
  
  return html;
}

// --- Premium Shared Contenteditable Prompt Editor ---
interface VariablePromptEditorProps {
  currentNodeId: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minRows?: number;
  label?: React.ReactNode;
}

export function VariablePromptEditor({ currentNodeId, value, onChange, placeholder, minRows = 3, label }: VariablePromptEditorProps) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const [popoverOpened, setPopoverOpened] = useState(false);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const environmentVariables = useWorkflowStore((s) => s.environmentVariables);

  const variables = useMemo(
    () => getAvailableVariables(currentNodeId, nodes, edges, environmentVariables),
    [currentNodeId, nodes, edges, environmentVariables]
  );

  // Sync database state to html content only when content diverges
  useEffect(() => {
    if (editorRef.current) {
      const currentPlain = htmlToPlain(editorRef.current.innerHTML);
      // Strip trailing newline added by browsers in innerText
      const cleanedPlain = currentPlain.endsWith('\n') ? currentPlain.slice(0, -1) : currentPlain;
      if (cleanedPlain !== value) {
        editorRef.current.innerHTML = plainToHtml(value || '', variables);
      }
    }
  }, [value, variables]);

  const handleInput = () => {
    if (editorRef.current) {
      const currentPlain = htmlToPlain(editorRef.current.innerHTML);
      const cleanedPlain = currentPlain.endsWith('\n') ? currentPlain.slice(0, -1) : currentPlain;
      onChange(cleanedPlain);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '/') {
      setPopoverOpened(true);
      return;
    }

    // 如果参数弹出菜单处于开启状态，我们进行多重智能判定，确保对用户常规打字行为的「零侵入」
    if (popoverOpened) {
      // 1. 如果用户输入了空格（如打 '10 / 2'），立刻自动关闭
      if (e.key === ' ' || e.key === 'Spacebar') {
        setPopoverOpened(false);
        return;
      }

      // 2. 如果按了 Escape，立刻关闭
      if (e.key === 'Escape') {
        setPopoverOpened(false);
        return;
      }

      // 3. 动态检查光标前方字符：如果光标前面的字符不再是 '/'（说明已被用户删除，或用户在 '/' 后面继续打字如 '/usr'）
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.startOffset > 0 && range.startContainer.nodeType === Node.TEXT_NODE) {
          const text = range.startContainer.textContent || '';
          const prevChar = text.substring(range.startOffset - 1, range.startOffset);
          if (prevChar !== '/') {
            setPopoverOpened(false);
          }
        } else {
          // 如果当前节点清空，自动关闭
          setPopoverOpened(false);
        }
      }
    }
  };

  const insertVariable = (varValue: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    
    const matchedVar = variables.find(v => v.value === varValue);
    const varPath = varValue.substring(2, varValue.length - 1);
    const varName = varPath.split('.')[1] || varPath;
    
    let groupName = 'Start';
    if (varValue.startsWith('${sys.')) {
      groupName = 'SYSTEM';
    } else if (matchedVar) {
      groupName = matchedVar.nodeName;
    }
    
    const tagHtml = `<span class="variable-tag" contenteditable="false" data-val="${varValue}" style="display: inline-flex; align-items: center; background: var(--mantine-color-blue-light, #e8f4fd); border: 1px solid var(--mantine-color-blue-outline, #cbe4fb); color: var(--mantine-color-blue-filled, #155aef); border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 500; margin: 0 2px; user-select: none; font-family: system-ui; vertical-align: middle;">🏠 ${groupName} / (x) ${varName}</span>&nbsp;`;

    // Modern browser selection insertion
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      
      // 检查当前光标位置前一个字符是否为触发菜单的 '/'
      // 如果是，我们将 selection 起点向左扩展 1 位，使其包含 '/'，这样 deleteContents 就会干净利落地把它删掉
      if (range.startOffset > 0 && range.startContainer.nodeType === Node.TEXT_NODE) {
        const text = range.startContainer.textContent || '';
        const prevChar = text.substring(range.startOffset - 1, range.startOffset);
        if (prevChar === '/') {
          range.setStart(range.startContainer, range.startOffset - 1);
        }
      }
      
      range.deleteContents();
      
      const el = document.createElement('div');
      el.innerHTML = tagHtml;
      const frag = document.createDocumentFragment();
      let node;
      while ((node = el.firstChild)) {
        frag.appendChild(node);
      }
      range.insertNode(frag);
      
      // Move caret after inserted node
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.innerHTML += tagHtml;
    }
    
    handleInput();
    setPopoverOpened(false);
  };

  const groupedVars = useMemo(() => {
    const acc: Record<string, typeof variables> = {};
    variables.forEach((v) => {
      (acc[v.nodeName] = acc[v.nodeName] || []).push(v);
    });
    return acc;
  }, [variables]);

  return (
    <Stack gap={3} style={{ width: '100%' }}>
      {label && (
        <Text size="xs" fw={500} style={{ color: 'var(--flock-text-bright)' }}>
          {label}
        </Text>
      )}
      <Popover
        opened={popoverOpened && variables.length > 0}
        onChange={setPopoverOpened}
        position="bottom-end"
        withArrow
        shadow="md"
        withinPortal
      >
        <Popover.Target>
          <Box style={{ position: 'relative', width: '100%' }}>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onKeyUp={handleKeyUp}
              style={{
                width: '100%',
                minHeight: minRows * 24,
                padding: '8px 32px 8px 8px',
                borderRadius: '8px',
                border: '1px solid var(--flock-border-dim, #ced4da)',
                background: 'var(--flock-bg-surface, #fff)',
                color: 'var(--flock-text-primary, #212529)',
                fontSize: '12px',
                lineHeight: '1.6',
                outline: 'none',
                overflowY: 'auto',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                cursor: 'text',
              }}
            />
            {!value && placeholder && (
              <Text
                size="xs"
                c="dimmed"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 8,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  opacity: 0.6,
                }}
              >
                {placeholder}
              </Text>
            )}
            {variables.length > 0 && (
              <div style={{ position: 'absolute', right: 8, top: 6, zIndex: 2 }}>
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
    </Stack>
  );
}

// --- Wrappers maintaining exact compatibility ---
export interface VariableTextInputProps extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'onChange'> {
  currentNodeId: string;
  onChange: (val: string) => void;
}

export function VariableTextInput({ currentNodeId, onChange, value, label, placeholder, ...props }: VariableTextInputProps) {
  return (
    <VariablePromptEditor
      currentNodeId={currentNodeId}
      value={String(value ?? '')}
      onChange={onChange}
      placeholder={placeholder}
      minRows={1}
      label={label}
    />
  );
}

export interface VariableTextareaProps extends Omit<React.ComponentPropsWithoutRef<typeof Textarea>, 'onChange'> {
  currentNodeId: string;
  onChange: (val: string) => void;
}

export function VariableTextarea({ currentNodeId, onChange, value, label, placeholder, minRows = 3, ...props }: VariableTextareaProps) {
  return (
    <VariablePromptEditor
      currentNodeId={currentNodeId}
      value={String(value ?? '')}
      onChange={onChange}
      placeholder={placeholder}
      minRows={minRows}
      label={label}
    />
  );
}

