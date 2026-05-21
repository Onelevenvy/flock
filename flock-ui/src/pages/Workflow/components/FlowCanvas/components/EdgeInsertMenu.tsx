import { Box } from '@mantine/core';
import { NodePalette } from '../../NodePalette';
import { type NodeType } from '../../../nodeConfig';

interface EdgeInsertMenuProps {
  menuPortalPosition: { x: number; y: number } | null;
  onClose: () => void;
  onAddNode: (type: NodeType) => void;
}

export function EdgeInsertMenu({ menuPortalPosition, onClose, onAddNode }: EdgeInsertMenuProps) {
  if (!menuPortalPosition) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: 'transparent',
        }}
        onClick={onClose}
      />
      <Box
        style={{
          position: 'fixed',
          left: menuPortalPosition.x,
          top: menuPortalPosition.y,
          zIndex: 10000,
          animation: 'scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <NodePalette onAddNode={onAddNode} />
      </Box>
    </>
  );
}
