import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { type Assistant, type UpsertAssistant } from '../../../types/assistant';
import { parseMultiLang } from '../../../utils/i18n';

interface ModelProvider {
  id: string;
  provider_name: any;
}

interface Model {
  id: string;
  provider_id: string;
  model_name: string;
  categories: string[];
  is_online: boolean;
}

interface SkillInfo {
  name: string;
  display_name?: string;
}

export function useAssistantForm(
  initial: Assistant | null,
  opened: boolean,
  onSave: (data: Omit<UpsertAssistant, 'is_builtin' | 'sort_order'>) => Promise<void>,
  onClose: () => void,
) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('edit');
  const [modelSelectData, setModelSelectData] = useState<{ group: string; items: { value: string; label: string }[] }[]>([]);
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
      setDisabledTools(initial.disabled_tools || []);
      setSelectedSkills(initial.skills);
    } else {
      setName('');
      setIcon('🤖');
      setDescription('');
      setModel(null);
      setSystemPrompt('');
      setSelectedTools([]);
      setDisabledTools([]);
      setSelectedSkills([]);
    }
    loadOptions();
  }, [opened, initial]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [providers, skills] = await Promise.all([
        invoke<ModelProvider[]>('list_providers'),
        invoke<SkillInfo[]>('list_skills'),
      ]);

      const grouped: Record<string, { value: string; label: string }[]> = {};
      for (const p of providers) {
        try {
          const ms = await invoke<Model[]>('list_models', { providerId: p.id });
          const chat = ms.filter((m) => m.categories.includes('chat') && m.is_online);
          if (chat.length > 0) {
            grouped[parseMultiLang(p.provider_name)] = chat.map((m) => ({
              value: `${p.id}:${m.model_name}`,
              label: m.model_name,
            }));
          }
        } catch {
          /* ignore */
        }
      }
      setModelSelectData(Object.entries(grouped).map(([group, items]) => ({ group, items })));
      setSkillSelectData(
        skills.map((s) => ({
          value: s.name,
          label: s.display_name || s.name,
        })),
      );
    } catch (e) {
      console.error('Failed to load options:', e);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({
        title: t('assistant.form.nameRequired'),
        message: '',
        color: 'orange',
        autoClose: 3000,
      });
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
        disabled_tools: disabledTools,
        skills: selectedSkills,
      });
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return {
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
  };
}
