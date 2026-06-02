import React, { memo, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { Box, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { BaseWorkflowNode } from '../BaseWorkflowNode';
import { type BaseNodeData } from '../types';
import { parseVariableTemplate, resolveVariableDetails } from '@/pages/Workflow/PropertiesPanel/helper';

export const AnswerNode = memo((props: NodeProps<BaseNodeData>) => {
  const { data } = props;
  const { t } = useTranslation();

  const renderContent = useCallback((variables: any[]) => {
    const text = String(data.answer || '');
    if (!text) {
      return (
        <Box style={{ padding: '8px 12px', minHeight: 38, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', fontSize: 10 }}>
            {t('workflow.nodes.noOutputTemplate', 'No Output Template')}
          </Text>
        </Box>
      );
    }

    const segments = parseVariableTemplate(text, variables);

    return (
      <Box style={{ padding: '8px 12px', minHeight: 38, display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <Box style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 4px', fontSize: 10, color: 'var(--flock-text-primary)', lineHeight: 1.5 }}>
          {segments.map((seg, index) => {
            if (seg.type === 'variable') {
              const match = seg.content;
              const matchedVar = seg.variable;
              const { varName, groupName, bgColor, borderColor, textColor, icon } = resolveVariableDetails(match, matchedVar);

              return (
                <span
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    color: textColor,
                    borderRadius: '4px',
                    padding: '1px 5px',
                    fontSize: '9px',
                    fontWeight: 500,
                    userSelect: 'none',
                    fontFamily: 'system-ui',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {icon} {groupName} / (x) {varName}
                </span>
              );
            }
            return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{seg.content}</span>;
          })}
        </Box>
      </Box>
    );
  }, [data.answer, t]);

  return <BaseWorkflowNode {...props} type="answer" renderContent={renderContent} />;
});
AnswerNode.displayName = 'AnswerNode';
