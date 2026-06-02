import { Select, Textarea } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export interface CodeNodePropertiesProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
}

export function CodeNodeProperties({ node, onDataChange }: CodeNodePropertiesProps) {
  const { t } = useTranslation();
  return (
    <>
      <Select
        label={t('workflow.properties.code.language')}
        data={['python', 'javascript']}
        value={String(node.data.language ?? 'python')}
        onChange={(v) => onDataChange(node.id, 'language', v)}
        size="xs"
      />
      <Textarea
        label={t('workflow.properties.code.code')}
        placeholder="# Your code here"
        value={String(node.data.code ?? '')}
        onChange={(e) => onDataChange(node.id, 'code', e.target.value)}
        minRows={6}
        size="xs"
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
      />
    </>
  );
}
