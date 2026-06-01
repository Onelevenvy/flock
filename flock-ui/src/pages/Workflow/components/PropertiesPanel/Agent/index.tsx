import { Divider, MultiSelect, Group, Text, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LLMFields } from '@/pages/Workflow/components/PropertiesPanel/LLM';
import ToolManager from '@/components/Common/ToolManager';
import { useSkillsQuery } from '@/hooks/useToolQueries';

export interface AgentFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
  toolOptions: any[];
  toolsLoading: boolean;
}

export function AgentFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
  toolOptions,
  toolsLoading,
}: AgentFieldsProps) {
  const { t } = useTranslation();
  const tools = (node.data.tools as string[]) ?? [];
  const disabledTools = (node.data.disabled_tools as string[]) ?? [];
  const sensitiveTools = (node.data.sensitive_tools as string[]) ?? [];
  const selectedSkills = (node.data.skills as string[]) ?? [];

  // 获取可用的 skills 列表
  const { data: skills = [], isLoading: loadingSkills } = useSkillsQuery();
  const skillSelectData = skills.map((s) => ({
    value: s.name,
    label: s.display_name || s.name,
  }));

  const showSkillsSelector = tools.includes('Skill');

  return (
    <Stack gap="md">
      <LLMFields
        node={node}
        onDataChange={onDataChange}
        modelOptions={modelOptions}
        modelsLoading={modelsLoading}
      />
      <Divider label={t('workflow.properties.agent.tools')} labelPosition="center" />
      <ToolManager
        value={tools}
        onChange={(v) => onDataChange(node.id, 'tools', v)}
        disabledValue={disabledTools}
        onDisabledChange={(v) => onDataChange(node.id, 'disabled_tools', v)}
        sensitiveValue={sensitiveTools}
        onSensitiveChange={(v) => onDataChange(node.id, 'sensitive_tools', v)}
        disabled={toolsLoading}
        selectorPosition="bottom-end"
      />

      {showSkillsSelector && (
        <Stack gap={6}>
          <Divider label={t('assistant.form.skillsLabel', '可调用的技能')} labelPosition="center" />
          <MultiSelect
            placeholder={loadingSkills ? t('common.loading') : t('assistant.form.skillsPlaceholder', '请选择可选技能...')}
            data={skillSelectData}
            value={selectedSkills}
            onChange={(v) => onDataChange(node.id, 'skills', v)}
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
          {selectedSkills.length === 0 && (
            <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', paddingLeft: 4 }}>
              💡 {t('workflow.properties.agent.allSkillsPrompt', '未指定技能时，工作流 Agent 默认可调用全部技能。')}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}
