import { useTranslation } from 'react-i18next';
import { VariableTextarea } from '@/pages/Workflow/components/PropertiesPanel/VariableInput';

export interface AnswerNodePropertiesProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function AnswerNodeProperties({ node, onDataChange }: AnswerNodePropertiesProps) {
  const { t } = useTranslation();
  return (
    <VariableTextarea
      label={t('workflow.properties.answer.template')}
      placeholder="${llm.response}"
      value={String(node.data.answer ?? '')}
      currentNodeId={node.id}
      onChange={(val) => onDataChange(node.id, 'answer', val)}
      minRows={4}
      size="xs"
    />
  );
}
