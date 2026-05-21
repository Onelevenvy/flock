import { useState, useEffect, useCallback } from 'react';
import { Modal, Group, ThemeIcon, Text, ScrollArea, Stack, TextInput, Textarea, Select, Divider, MultiSelect, Badge, Button, Tabs, Box } from '@mantine/core';
import { IconEdit, IconPlus, IconCheck } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { type Assistant, type UpsertAssistant } from '../../types/assistant';
import { IconPicker } from './IconPicker';
import { MarkdownRenderer } from '../../components/chat/MarkdownRenderer';
import ToolManager from '../../components/Common/ToolManager';


interface ModelProvider { id: string; provider_name: string; }
interface Model { id: string; provider_id: string; model_name: string; categories: string[]; is_online: boolean; }
interface ToolProvider { id: string; provider_name: string; is_available: boolean; }
interface SkillInfo { name: string; display_name?: string; }

export function AssistantFormModal({
  opened,
  initial,
  onClose,
  onSave,
}: {
  opened: boolean;
  initial: Assistant | null;
  onClose: () => void;
  onSave: (data: Omit<UpsertAssistant, 'is_builtin' | 'sort_order'>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('edit');

  const [modelSelectData, setModelSelectData] = useState<{ group: string; items: { value: string; label: string }[] }[]>([]);
  const [toolSelectData, setToolSelectData] = useState<{ value: string; label: string }[]>([]);
  const [skillSelectData, setSkillSelectData] = useState<{ value: string; label: string }[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const isEditing = !!initial;
  const isBuiltin = initial?.is_builtin ?? false;

  useEffect(() => {
    if (!opened) return;
    setActiveTab('edit');
    if (initial) {
      setName(initial.name);
      setIcon(initial.icon);
      setDescription(initial.description);
      setModel(initial.model || null);
      setSystemPrompt(initial.system_prompt);
      setSelectedTools(initial.tools);
      setSelectedSkills(initial.skills);
    } else {
      setName('');
      setIcon('🤖');
      setDescription('');
      setModel(null);
      setSystemPrompt('');
      setSelectedTools([]);
      setSelectedSkills([]);
    }
    loadOptions();
  }, [opened, initial]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [providers, toolProviders, skills] = await Promise.all([
        invoke<ModelProvider[]>('list_providers'),
        invoke<ToolProvider[]>('list_tool_providers'),
        invoke<SkillInfo[]>('list_skills'),
      ]);

      const grouped: Record<string, { value: string; label: string }[]> = {};
      for (const p of providers) {
        try {
          const ms = await invoke<Model[]>('list_models', { providerId: p.id });
          const chat = ms.filter(m => m.categories.includes('chat') && m.is_online);
          if (chat.length > 0) {
            grouped[p.provider_name] = chat.map(m => ({
              value: `${p.id}:${m.model_name}`,
              label: m.model_name,
            }));
          }
        } catch { /* ignore */ }
      }
      setModelSelectData(Object.entries(grouped).map(([group, items]) => ({ group, items })));
      setToolSelectData(toolProviders.map(p => ({
        value: p.id,
        label: `${p.provider_name}${p.is_available ? '' : t('assistant.form.unauthorized')}`,
      })));
      setSkillSelectData(skills.map(s => ({
        value: s.name,
        label: s.display_name || s.name,
      })));
    } catch (e) {
      console.error('Failed to load options:', e);
    } finally {
      setLoadingOptions(false);
    }
  }, [t]);

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({ title: t('assistant.form.nameRequired'), message: '', color: 'orange', autoClose: 3000 });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        icon,
        description: description.trim(),
        model: model || '',
        system_prompt: systemPrompt.trim(),
        tools: selectedTools,
        skills: selectedSkills,
      });
      onClose();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="md" radius="md">
            {isEditing ? <IconEdit size={16} /> : <IconPlus size={16} />}
          </ThemeIcon>
          <Text fw={700} size="md">
            {isEditing ? t('assistant.form.editTitle') : t('assistant.form.createTitle')}
          </Text>
        </Group>
      }
      size="lg"
      styles={{
        content: {
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-dim)',
        },
        header: {
          background: 'var(--flock-bg-raised)',
          borderBottom: '1px solid var(--flock-border-subtle)',
        },
      }}
    >
      <ScrollArea mah="72vh" styles={{ viewport: { maxHeight: '72vh' } }} offsetScrollbars>
        <Stack gap="md" pt="xs" pb="xl" px="xs">
          {/* 名称及头像 — 同行 */}
          <Stack gap={4}>
            <Text size="sm" fw={500} mb={2} style={{ color: 'var(--flock-text-secondary)', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fa5252', marginRight: 4 }}>*</span>
              {t('assistant.form.nameAndAvatar')}
            </Text>
            <Group gap="xs" style={{ width: '100%', alignItems: 'center' }}>
              <IconPicker value={icon} onChange={setIcon} />
              <TextInput
                placeholder={t('assistant.form.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={isBuiltin}
                style={{ flex: 1 }}
                styles={{
                  input: {
                    background: 'var(--flock-bg-surface)',
                    border: '1px solid var(--flock-border-dim)',
                    height: 38,
                  },
                }}
              />
            </Group>
          </Stack>

          {/* 描述 */}
          <Textarea
            label={t('assistant.form.descLabel')}
            placeholder={t('assistant.form.descPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            rows={2}
            disabled={isBuiltin}
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />

          {/* 选择模型 */}
          <Select
            label={t('assistant.form.modelLabel')}
            placeholder={loadingOptions ? t('common.loading') : t('assistant.form.modelPlaceholder')}
            data={modelSelectData}
            value={model}
            onChange={setModel}
            searchable
            clearable
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              },
              dropdown: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />

          {/* 系统提示词 */}
          <Stack gap={4}>
            <Group justify="space-between">
              <Group gap={6}>
                <Text size="sm" fw={500}>{t('assistant.form.promptLabel')}</Text>
              </Group>
            </Group>

            <Tabs value={activeTab} onChange={setActiveTab} variant="unstyled">
              <Tabs.List style={{ display: 'flex', gap: 16, borderBottom: 'none', marginBottom: 8 }}>
                <Tabs.Tab
                  value="edit"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    fontSize: 13,
                    fontWeight: activeTab === 'edit' ? 600 : 400,
                    color: activeTab === 'edit' ? 'var(--flock-accent)' : 'var(--flock-text-dim, #888)',
                    borderBottom: activeTab === 'edit' ? '2px solid var(--flock-accent)' : '2px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('common.edit')}
                </Tabs.Tab>
                <Tabs.Tab
                  value="preview"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    fontSize: 13,
                    fontWeight: activeTab === 'preview' ? 600 : 400,
                    color: activeTab === 'preview' ? 'var(--flock-accent)' : 'var(--flock-text-dim, #888)',
                    borderBottom: activeTab === 'preview' ? '2px solid var(--flock-accent)' : '2px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('common.preview')}
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="edit">
                <Textarea
                  placeholder={t('assistant.form.promptPlaceholder')}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.currentTarget.value)}
                  rows={8}
                  styles={{
                    input: {
                      background: 'var(--flock-bg-surface)',
                      border: '1px solid var(--flock-border-dim)',
                      fontFamily: 'var(--mantine-font-family-monospace)',
                      fontSize: 12,
                      lineHeight: 1.6,
                    },
                  }}
                />
              </Tabs.Panel>

              <Tabs.Panel value="preview">
                <Box
                  p="sm"
                  className="markdown-body"
                  style={{
                    background: 'var(--flock-bg-surface)',
                    border: '1px solid var(--flock-border-dim)',
                    borderRadius: '8px',
                    minHeight: '172px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'var(--flock-text-bright)',
                  }}
                >
                  {systemPrompt.trim() ? (
                    <MarkdownRenderer content={systemPrompt} />
                  ) : (
                    <Text c="dimmed" fs="italic" size="xs">
                      {t('assistant.form.previewPlaceholder')}
                    </Text>
                  )}
                </Box>
              </Tabs.Panel>
            </Tabs>
          </Stack>

          <Divider color="var(--flock-border-subtle)" />

          {/* 绑定工具 */}
          <ToolManager
            label={t('assistant.form.toolsLabel')}
            value={selectedTools}
            onChange={setSelectedTools}
            selectorPosition="bottom-start"
          />

          {/* 绑定技能 */}
          <MultiSelect
            label={
              <Group gap={6}>
                <Text size="sm" fw={500}>{t('assistant.form.skillsLabel')}</Text>
              </Group>
            }
            placeholder={t('assistant.form.skillsPlaceholder')}
            data={skillSelectData}
            value={selectedSkills}
            onChange={setSelectedSkills}
            searchable
            styles={{
              input: {
                background: 'var(--flock-bg-surface)',
                border: '1px solid var(--flock-border-dim)',
              },
              dropdown: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />
        </Stack>
      </ScrollArea>

      <Divider color="var(--flock-border-subtle)" />
      <Group justify="flex-end" pt="md" px="xs">
        <Button variant="subtle" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          color="blue"
          loading={saving}
          leftSection={isEditing ? <IconCheck size={16} /> : <IconPlus size={16} />}
          onClick={handleSave}
          style={{ background: 'var(--flock-accent)' }}
        >
          {isEditing ? t('common.saveChanges') : t('assistant.createBtn')}
        </Button>
      </Group>
    </Modal>
  );
}
