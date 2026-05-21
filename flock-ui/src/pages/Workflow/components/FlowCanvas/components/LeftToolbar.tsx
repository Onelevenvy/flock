import { Box, Divider, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconPlus,
  IconPointer,
  IconHandGrab,
  IconHierarchy,
  IconMaximize,
  IconLayoutGrid,
} from '@tabler/icons-react';

import { type FitViewOptions } from 'reactflow';

interface LeftToolbarProps {
  showNodePalette: boolean;
  setShowNodePalette: (v: boolean | ((prev: boolean) => boolean)) => void;
  isPanMode: boolean;
  setIsPanMode: (v: boolean) => void;
  layoutAllNodes: () => void;
  fitView: (options?: FitViewOptions) => void;
  showMinimap: boolean;
  setShowMinimap: (v: boolean | ((prev: boolean) => boolean)) => void;
  t: (key: string, defaultValue?: string) => string;
}

export function LeftToolbar({
  showNodePalette,
  setShowNodePalette,
  isPanMode,
  setIsPanMode,
  layoutAllNodes,
  fitView,
  showMinimap,
  setShowMinimap,
  t,
}: LeftToolbarProps) {
  return (
    <Box
      style={{
        position: 'absolute',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 100,
        background: 'var(--flock-bg-surface)',
        border: '1px solid var(--flock-border-subtle)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
      }}
    >
      {/* 1. Add Node (+) */}
      <Tooltip label={t('workflow.addNode', 'Add Node')} position="right" withArrow>
        <ActionIcon
          variant={showNodePalette ? 'filled' : 'subtle'}
          color={showNodePalette ? 'blue' : 'gray'}
          radius="md"
          size="md"
          onClick={() => setShowNodePalette((v) => !v)}
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider style={{ width: '80%' }} />

      {/* 2. Selection Mode (Mouse Pointer) */}
      <Tooltip label={t('workflow.selectMode', 'Select Mode')} position="right" withArrow>
        <ActionIcon
          variant={!isPanMode ? 'light' : 'subtle'}
          color={!isPanMode ? 'blue' : 'gray'}
          radius="md"
          size="md"
          onClick={() => setIsPanMode(false)}
        >
          <IconPointer size={16} />
        </ActionIcon>
      </Tooltip>

      {/* 3. Pan Mode (Hand Grab) */}
      <Tooltip label={t('workflow.panMode', 'Pan Mode')} position="right" withArrow>
        <ActionIcon
          variant={isPanMode ? 'light' : 'subtle'}
          color={isPanMode ? 'blue' : 'gray'}
          radius="md"
          size="md"
          onClick={() => setIsPanMode(true)}
        >
          <IconHandGrab size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider style={{ width: '80%' }} />

      {/* 4. Auto Layout */}
      <Tooltip label={t('workflow.autoLayout', 'Auto Layout')} position="right" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="md"
          size="md"
          onClick={() => layoutAllNodes()}
        >
          <IconHierarchy size={16} />
        </ActionIcon>
      </Tooltip>

      {/* 5. Fit View */}
      <Tooltip label={t('workflow.fitView', 'Fit View')} position="right" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="md"
          size="md"
          onClick={() => fitView({ padding: 0.25 })}
        >
          <IconMaximize size={16} />
        </ActionIcon>
      </Tooltip>

      {/* 6. Minimap Toggle */}
      <Tooltip label={t('workflow.minimap', 'Minimap')} position="right" withArrow>
        <ActionIcon
          variant={showMinimap ? 'filled' : 'subtle'}
          color={showMinimap ? 'blue' : 'gray'}
          radius="md"
          size="md"
          onClick={() => setShowMinimap((v) => !v)}
        >
          <IconLayoutGrid size={16} />
        </ActionIcon>
      </Tooltip>
    </Box>
  );
}
