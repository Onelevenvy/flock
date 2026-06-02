import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { type BaseNodeData } from './types';
import { handleStyle } from './styles';

// 定义分支的标准数据格式
export interface WorkflowNodeBranch {
  id: string;         // 连线 Handle 的唯一标识 (case_id 或 category_id)
  title: string;      // 分支的主标题 (如 "IF 1", "CLASS 2", "TIMEOUT")
  subtitle?: string;  // 分支的副标题/具体描述 (可选)
  titleColor?: string; // 💡 支持分支主标题自定义颜色（比如超时分支可以显示红色）
}

export interface BaseBranchWorkflowNodeProps extends NodeProps<BaseNodeData> {
  type: NodeType;
  branches: WorkflowNodeBranch[];
}

export const BaseBranchWorkflowNode = memo(({
  id,
  type,
  data,
  selected,
  branches,
}: BaseBranchWorkflowNodeProps) => {
  const { t } = useTranslation();
  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Box className={`flock-workflow-node ${selected ? 'selected' : ''}`} style={{ overflow: 'visible' }}>
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      
      {/* 1. 统一的 Header */}
      <Box style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--flock-border-subtle)' }}>
        <Box className="flock-node-icon-container" style={{ background: `${cfg.colorHex}15` }}>
          <Icon size={14} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
      </Box>

      {/* 2. 动态分支渲染列表 */}
      <Box style={{ padding: '8px 12px' }}>
        {branches.map((br) => (
          <Box key={br.id} style={{ position: 'relative', marginBottom: 6 }}>
            <Box style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: 'var(--flock-bg-raised, rgba(0, 0, 0, 0.02))',
              border: '1px solid var(--flock-border-subtle)',
              marginRight: 6,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <Text size="xs" fw={700} style={{ fontSize: 10, color: br.titleColor || 'var(--flock-text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {br.title}
              </Text>
              {br.subtitle && (
                <Text size="xs" c="dimmed" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {br.subtitle}
                </Text>
              )}
            </Box>

            {/* 统一的右侧 Handle + 连线加号 */}
            <div className="flock-handle-container" style={{ position: 'absolute', top: '50%', right: -40, transform: 'translateY(-50%)', width: 32, height: 20, zIndex: 10 }}>
              <Handle
                type="source"
                position={Position.Right}
                id={br.id}
                style={{ background: 'var(--flock-bg-surface)', border: `2px solid var(--flock-accent)`, width: 8, height: 8, top: '50%', left: 0, transform: 'translateY(-50%)' }}
              />
              <div className="flock-handle-plus">
                <ActionIcon
                  size="16px"
                  radius="xl"
                  variant="filled"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.15)', cursor: 'pointer', background: 'var(--flock-accent, #155aef)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (data.onHandlePlusClick) {
                      data.onHandlePlusClick(id, br.id, e.clientX, e.clientY);
                    }
                  }}
                >
                  <IconPlus size={10} stroke={3} />
                </ActionIcon>
              </div>
            </div>
          </Box>
        ))}
      </Box>

      {/* 3. 左侧统一输入锚点 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: 'var(--flock-bg-surface)', border: `2px solid var(--flock-accent)`, width: 8, height: 8 }}
      />
    </Box>
  );
});

BaseBranchWorkflowNode.displayName = 'BaseBranchWorkflowNode';
