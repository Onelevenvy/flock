import { Modal, Group, ThemeIcon, Text, ScrollArea, Stack, TextInput, Textarea, Select, Divider, MultiSelect, Button, Tabs, Box } from '@mantine/core';
import { IconEdit, IconPlus, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { type Assistant, type UpsertAssistant } from '../../types/assistant';
import { IconPicker } from './IconPicker';
import { MarkdownRenderer } from '../../components/chat/shared/MarkdownRenderer';
import ToolManager from '../../components/Common/ToolManager';
import { useAssistantForm } from './hooks/useAssistantForm';

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

  const {
    name, setName,
    icon, setIcon,
    description, setDescription,
    model, setModel,
    systemPrompt, setSystemPrompt,
    selectedTools, setSelectedTools,
    disabledTools, setDisabledTools,
    selectedSkills, setSelectedSkills,
    saving,
    activeTab, setActiveTab,
    modelSelectData,
    skillSelectData,
    loadingOptions,
    isEditing,
    isBuiltin,
    handleSave,
  } = useAssistantForm(initial, opened, onSave, onClose);

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

          <ToolManager
            label={t('assistant.form.toolsLabel')}
            value={selectedTools}
            onChange={setSelectedTools}
            disabledValue={disabledTools}
            onDisabledChange={setDisabledTools}
            selectorPosition="bottom-start"
          />

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
