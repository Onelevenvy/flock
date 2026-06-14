import React, { useEffect, useCallback } from 'react';
import {
  Box,
  Group,
  Text,
  Badge,
  ThemeIcon,
  Code,
  ScrollArea,
  Input,
  TextInput,
  Textarea,
  Button,
  Checkbox,
  Switch,
  Stack,
} from '@mantine/core';
import {
  IconEye,
  IconEdit,
  IconTerminal2,
  IconPlug,
  IconUser,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { PendingApproval, ToolCategory } from '@/types/protocol';
import { useAgentStore } from '@/store/agentStore';
import { useUiStore } from '@/store/uiStore';

interface AskHumanField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multi-select' | 'boolean';
  options?: string[];
  required?: boolean;
}

interface ToolApprovalInlineProps {
  approval: PendingApproval | null;
}

const CATEGORY_CONFIG: Record<
  ToolCategory,
  { color: string; label: string; icon: React.ReactNode; riskKey: string }
> = {
  info: {
    color: 'blue',
    label: 'Info',
    icon: <IconEye size={14} />,
    riskKey: 'chat.approval.riskRead',
  },
  edit: {
    color: 'orange',
    label: 'Edit',
    icon: <IconEdit size={14} />,
    riskKey: 'chat.approval.riskWrite',
  },
  exec: {
    color: 'red',
    label: 'Exec',
    icon: <IconTerminal2 size={14} />,
    riskKey: 'chat.approval.riskExec',
  },
  mcp: {
    color: 'grape',
    label: 'MCP',
    icon: <IconPlug size={14} />,
    riskKey: 'chat.approval.riskMcp',
  },
};

export function ToolApprovalInline({ approval }: ToolApprovalInlineProps) {
  const { t } = useTranslation();
  const removePendingApproval = useAgentStore((s) => s.removePendingApproval);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [feedback, setFeedback] = React.useState('');
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});

  useEffect(() => {
    setFeedback('');
    if (approval?.tool?.name === 'AskHuman') {
      const initialValues: Record<string, any> = {};
      let fields = (approval.tool.args as any)?.fields;
      if (typeof fields === 'string') {
        try {
          fields = JSON.parse(fields);
        } catch {
          fields = null;
        }
      }
      if (Array.isArray(fields)) {
        (fields as AskHumanField[]).forEach((f) => {
          if (f.type === 'boolean') {
            initialValues[f.id] = false;
          } else if (f.type === 'multi-select') {
            initialValues[f.id] = [];
          } else {
            initialValues[f.id] = '';
          }
        });
      }
      setFormValues(initialValues);
    }
  }, [approval?.call_id]);

  const isFormValid = useCallback(() => {
    if (approval?.tool?.name !== 'AskHuman') return true;
    let fields = (approval.tool.args as any)?.fields;
    if (typeof fields === 'string') {
      try {
        fields = JSON.parse(fields);
      } catch {
        fields = null;
      }
    }
    if (!Array.isArray(fields)) return true;
    for (const f of (fields as AskHumanField[])) {
      if (f.required) {
        const val = formValues[f.id];
        if (f.type === 'multi-select') {
          if (!val || val.length === 0) return false;
        } else if (f.type === 'boolean') {
          if (val === undefined) return false;
        } else {
          if (!val || String(val).trim() === '') return false;
        }
      }
    }
    return true;
  }, [approval, formValues]);

  const handleApprove = useCallback(
    async (scope: 'once' | 'always') => {
      if (!approval) return;
      removePendingApproval(approval.call_id);
      let payload = '';
      if (approval.tool.name === 'AskHuman') {
        let fields = (approval.tool.args as any)?.fields;
        if (typeof fields === 'string') {
          try {
            fields = JSON.parse(fields);
          } catch {
            fields = null;
          }
        }
        if (Array.isArray(fields) && fields.length > 0) {
          payload = JSON.stringify(formValues);
        } else {
          payload = feedback.trim() || 'Confirmed';
        }
      }
      await invoke('approve_tool', { callId: approval.call_id, scope, feedback: payload || null });
    },
    [approval, removePendingApproval, formValues, feedback]
  );

  const handleDeny = useCallback(async () => {
    if (!approval) return;
    const reason = feedback.trim() || 'User denied';
    removePendingApproval(approval.call_id);
    await invoke('deny_tool', { callId: approval.call_id, reason });
  }, [approval, removePendingApproval, feedback]);

  const getOptionLabel = (opt: any): string => {
    if (typeof opt === 'string') return opt;
    if (typeof opt === 'number') return String(opt);
    if (opt && typeof opt === 'object') {
      return opt.label || opt.name || opt.value || opt.id || JSON.stringify(opt);
    }
    return '';
  };

  const getOptionValue = (opt: any): string => {
    if (typeof opt === 'string') return opt;
    if (typeof opt === 'number') return String(opt);
    if (opt && typeof opt === 'object') {
      return opt.value || opt.id || opt.key || opt.label || JSON.stringify(opt);
    }
    return '';
  };

  const handleSelectToggle = (fieldId: string, val: string) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
  };

  const handleMultiSelectToggle = (fieldId: string, val: string) => {
    setFormValues((prev) => {
      const currentList = (prev[fieldId] as string[]) || [];
      const newList = currentList.includes(val)
        ? currentList.filter((item) => item !== val)
        : [...currentList, val];
      return {
        ...prev,
        [fieldId]: newList,
      };
    });
  };

  // 键盘快捷键：Enter=允许一次, A=始终允许, Esc=拒绝 (AskHuman 排除回车快捷键以避免输入时误触提交)
  useEffect(() => {
    if (!approval) return;
    if (approval.tool.name === 'AskHuman') return;

    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleApprove('once');
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleApprove('always');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleDeny();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [approval, handleApprove, handleDeny]);

  const fields = React.useMemo(() => {
    const rawFields = (approval?.tool?.args as any)?.fields;
    if (!rawFields) return [];
    if (Array.isArray(rawFields)) return rawFields as AskHumanField[];
    if (typeof rawFields === 'string') {
      try {
        const parsed = JSON.parse(rawFields);
        if (Array.isArray(parsed)) return parsed as AskHumanField[];
      } catch (e) {
        console.error('Failed to parse fields:', e);
      }
    }
    return [];
  }, [approval?.tool?.args]);

  if (!approval) return null;

  const { tool } = approval;
  const isAskHuman = tool.name === 'AskHuman';
  const config = CATEGORY_CONFIG[tool.category] || CATEGORY_CONFIG.exec;
  const riskText = isAskHuman ? 'Interactive' : t(config.riskKey);
  const argsStr = JSON.stringify(tool.args, null, 2);

  const displayArgs = (() => {
    const args = tool.args as Record<string, unknown>;
    const primary = args.path || args.command || args.content || args.query || args.url;
    if (typeof primary === 'string') {
      return primary.length > 120 ? primary.slice(0, 120) + '...' : primary;
    }
    return null;
  })();

  const hasFields = isAskHuman && fields.length > 0;

  return (
    <Box
      style={{
        margin: '8px 16px',
        borderRadius: 10,
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* 标题行 */}
      <Box
        style={{
          padding: '10px 14px 8px',
          background: 'var(--flock-bg-surface)',
          borderBottom: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ThemeIcon size="sm" color={isAskHuman ? 'blue' : config.color} variant="light" radius="sm">
          {isAskHuman ? <IconUser size={14} /> : config.icon}
        </ThemeIcon>
        <Text size="sm" fw={600} c={isDark ? `${isAskHuman ? 'blue' : config.color}.3` : `${isAskHuman ? 'blue' : config.color}.8`}>
          {tool.name}
        </Text>
        <Badge size="xs" color={isAskHuman ? 'blue' : config.color} variant="dot">
          {riskText}
        </Badge>
        <Text
          size="xs"
          c="dimmed"
          style={{
            marginLeft: 'auto',
            opacity: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '40%',
          }}
          title={tool.description}
        >
          {tool.description}
        </Text>
      </Box>

      {/* 参数内容 */}
      <ScrollArea.Autosize mah={isAskHuman ? 400 : 150} style={{ padding: '8px 14px' }} offsetScrollbars>
        {isAskHuman ? (
          <Stack gap="xs" style={{ width: '100%' }}>
            <Text size="xs" fw={500} c="var(--flock-text-bright)">
              {(tool.args as any)?.prompt}
            </Text>
            {fields.map((field) => (
              <Box key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Text size="xs" fw={600} style={{ display: 'flex', gap: 2, color: 'var(--flock-text-muted)' }}>
                  {field.label}
                  {field.required && <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>}
                </Text>
                {field.type === 'textarea' ? (
                  <Textarea
                    size="xs"
                    value={formValues[field.id] || ''}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.currentTarget.value }))}
                    placeholder={field.label}
                    styles={{
                      input: {
                        backgroundColor: 'var(--flock-bg-deepest)',
                        border: '1px solid var(--flock-border-dim)',
                        color: 'var(--flock-text-primary)',
                      }
                    }}
                  />
                ) : field.type === 'select' ? (
                  <Group gap="xs" mt={2}>
                    {(Array.isArray(field.options) ? field.options : [])?.map((opt) => {
                      const optVal = getOptionValue(opt);
                      const optLabel = getOptionLabel(opt);
                      const isSelected = formValues[field.id] === optVal;
                      return (
                        <Button
                          key={optVal}
                          size="xs"
                          variant={isSelected ? 'filled' : 'outline'}
                          color={isSelected ? 'blue' : 'gray'}
                          onClick={() => handleSelectToggle(field.id, optVal)}
                          styles={{
                            root: {
                              height: '28px',
                              borderRadius: '6px',
                            }
                          }}
                        >
                          {optLabel}
                        </Button>
                      );
                    })}
                  </Group>
                ) : field.type === 'multi-select' ? (
                  <Group gap="xs" mt={2}>
                    {(Array.isArray(field.options) ? field.options : [])?.map((opt) => {
                      const optVal = getOptionValue(opt);
                      const optLabel = getOptionLabel(opt);
                      const isSelected = (formValues[field.id] as string[])?.includes(optVal);
                      return (
                        <Button
                          key={optVal}
                          size="xs"
                          variant={isSelected ? 'filled' : 'outline'}
                          color={isSelected ? 'blue' : 'gray'}
                          onClick={() => handleMultiSelectToggle(field.id, optVal)}
                          styles={{
                            root: {
                              height: '28px',
                              borderRadius: '6px',
                            }
                          }}
                        >
                          {isSelected ? `✓ ${optLabel}` : optLabel}
                        </Button>
                      );
                    })}
                  </Group>
                ) : field.type === 'boolean' ? (
                  <Switch
                    size="xs"
                    checked={!!formValues[field.id]}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.currentTarget.checked }))}
                    styles={{
                      track: {
                        cursor: 'pointer',
                      }
                    }}
                  />
                ) : (
                  <TextInput
                    size="xs"
                    value={formValues[field.id] || ''}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.currentTarget.value }))}
                    placeholder={field.label}
                    styles={{
                      input: {
                        backgroundColor: 'var(--flock-bg-deepest)',
                        border: '1px solid var(--flock-border-dim)',
                        color: 'var(--flock-text-primary)',
                      }
                    }}
                  />
                )}
              </Box>
            ))}
          </Stack>
        ) : displayArgs ? (
          <Text
            size="xs"
            style={{
              fontFamily: 'var(--mantine-font-family-monospace)',
              color: 'var(--flock-text-dim)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {displayArgs}
          </Text>
        ) : (
          <Code
            block
            style={{
              fontSize: 11,
              background: 'transparent',
              color: 'var(--flock-text-muted)',
              padding: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {argsStr}
          </Code>
        )}
      </ScrollArea.Autosize>

      {/* 操作区 */}
      <Box
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Group gap={10}>
          {/* 允许/提交 */}
          <Group
            gap={6}
            style={{ cursor: isFormValid() ? 'pointer' : 'not-allowed', opacity: isFormValid() ? 1 : 0.5 }}
            onClick={() => isFormValid() && handleApprove('once')}
            className="approval-btn"
          >
            {!isAskHuman && (
              <Box
                style={{
                  width: 44,
                  height: 22,
                  borderRadius: 5,
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size="xs" fw={600} style={{ fontSize: 10, letterSpacing: '0.03em' }}>
                  Enter
                </Text>
              </Box>
            )}
            <Text size="xs" c={isDark ? 'teal.4' : 'teal.8'} fw={600}>
              {isAskHuman ? '提交' : (approval.is_workflow ? t('chat.approval.btnApprove') : t('chat.approval.btnApproveOnce'))}
            </Text>
          </Group>

          {/* 始终允许 */}
          {!approval.is_workflow && !isAskHuman && (
            <Group
              gap={6}
              style={{ cursor: 'pointer' }}
              onClick={() => handleApprove('always')}
              className="approval-btn"
            >
              <Box
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size="xs" fw={700} style={{ fontSize: 11 }}>
                  A
                </Text>
              </Box>
              <Text size="xs" c={isDark ? 'blue.4' : 'blue.8'} fw={600}>
                {t('chat.approval.btnApproveAlways')}
              </Text>
            </Group>
          )}

          {/* 拒绝 */}
          <Group
            gap={6}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            onClick={handleDeny}
            className="approval-btn"
          >
            {!isAskHuman && (
              <Box
                style={{
                  width: 34,
                  height: 22,
                  borderRadius: 5,
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size="xs" fw={600} style={{ fontSize: 10, letterSpacing: '0.03em' }}>
                  Esc
                </Text>
              </Box>
            )}
            <Text size="xs" c={isDark ? 'red.4' : 'red.8'} fw={600} style={{ whiteSpace: 'nowrap' }}>
              {(feedback.trim() && !hasFields) ? t('chat.approval.btnDenyWithFeedback') : t('chat.approval.btnDeny')}
            </Text>
          </Group>
        </Group>

        {/* 自由文本反馈输入框 (当不是 AskHuman 或者没有 fields 时才显示) */}
        {(!isAskHuman || !hasFields) && (
          <Input
            placeholder={t('chat.approval.feedbackPlaceholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            style={{ flexGrow: 1, maxWidth: '60%' }}
            size="xs"
            styles={{
              input: {
                height: 26,
                fontSize: '11px',
                backgroundColor: 'var(--flock-bg-deepest)',
                border: '1px solid var(--flock-border-dim)',
                color: 'var(--flock-text-primary)',
                borderRadius: '4px',
                width: '100%',
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDeny();
              }
            }}
          />
        )}
      </Box>
    </Box>
  );
}
