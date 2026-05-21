import { useCallback } from 'react';
import { type Node, useReactFlow, MarkerType } from 'reactflow';
import { nodeConfig, type NodeType } from '../../nodeConfig';

/**
 * Handles adding a node via palette click or drag-and-drop.
 */
export function useDropHandler(
  nodes: Node[],
  setNodes: (updater: (nds: Node[]) => Node[]) => void,
  setShowNodePalette: (v: boolean) => void,
) {
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = useCallback(
    (type: NodeType) => {
      if (!nodeConfig[type]) return;

      let position = { x: 250, y: 200 };
      try {
        position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      } catch (err) {
        console.error('Failed to project node position', err);
      }

      const sameTypeCount = nodes.filter((n) => n.type === type).length;
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setShowNodePalette(false);
    },
    [nodes, setNodes, screenToFlowPosition, setShowNodePalette]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/workflow-node') as NodeType;
      if (!type || !nodeConfig[type]) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const sameTypeCount = nodes.filter((n) => n.type === type).length;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setShowNodePalette(false);
    },
    [nodes, setNodes, screenToFlowPosition, setShowNodePalette]
  );

  return { handleAddNode, onDragOver, onDrop };
}
