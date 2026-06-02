import { useCallback, useState } from 'react';
import { type Edge, type Node, MarkerType } from 'reactflow';


import { useFlowLayout } from './useFlowLayout';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { useWorkflowStore } from '@/store/workflowStore';

interface ActiveSourceHandle {
  nodeId: string;
  handleId: string;
}

/**
 * Manages edge-click insertion state and the insert-node logic.
 * Handles both center-insert (between two nodes) and source-branch (fork) modes.
 */
export function useNodeInsertion(
  nodes: Node[],
  edges: Edge[],
  layoutAllNodes: ReturnType<typeof useFlowLayout>['layoutAllNodes'],
) {
  const { setNodes, setEdges } = useWorkflowStore();
  const [menuEdge, setMenuEdge] = useState<Edge | null>(null);
  const [activeSourceHandle, setActiveSourceHandle] = useState<ActiveSourceHandle | null>(null);
  const [insertMode, setInsertMode] = useState<'center' | 'source' | null>(null);
  const [menuPortalPosition, setMenuPortalPosition] = useState<{ x: number; y: number } | null>(null);

  const closeMenu = useCallback(() => {
    setMenuEdge(null);
    setActiveSourceHandle(null);
    setInsertMode(null);
    setMenuPortalPosition(null);
  }, []);

  const handleInsertNode = useCallback((type: NodeType, toolName?: string) => {
    if (!insertMode) return;

    const sameTypeCount = nodes.filter((n) => n.type === type).length;
    const newNodeId = `${type}-${Date.now()}`;

    if (insertMode === 'center') {
      if (!menuEdge) return;
      const sourceNode = nodes.find(n => n.id === menuEdge.source);
      const targetNode = nodes.find(n => n.id === menuEdge.target);
      if (!sourceNode || !targetNode) return;

      const position = {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      };

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          label: toolName || `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
          ...(toolName ? { tool: { name: toolName }, args: '' } : {}),
        },
      };

      const newEdge1 = {
        id: `e-${menuEdge.source}-${newNodeId}`,
        source: menuEdge.source,
        sourceHandle: menuEdge.sourceHandle,
        target: newNodeId,
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
        type: 'customStep',
      };

      const newEdge2 = {
        id: `e-${newNodeId}-${menuEdge.target}`,
        source: newNodeId,
        sourceHandle: 'right',
        target: menuEdge.target,
        targetHandle: menuEdge.targetHandle,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
        type: 'customStep',
      };

      layoutAllNodes([...nodes, newNode], [...edges.filter(e => e.id !== menuEdge.id), newEdge1, newEdge2]);
    } else {
      // 端点分叉模式
      const sourceNodeId = activeSourceHandle ? activeSourceHandle.nodeId : menuEdge?.source;
      const sourceHandleId = activeSourceHandle ? activeSourceHandle.handleId : menuEdge?.sourceHandle || 'right';
      if (!sourceNodeId) return;

      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return;

      const position = {
        x: sourceNode.position.x + 280,
        y: sourceNode.position.y + 120,
      };

      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          label: toolName || `${nodeConfig[type].display} ${sameTypeCount + 1}`,
          ...nodeConfig[type].initialData,
          ...(toolName ? { tool: { name: toolName }, args: '' } : {}),
        },
      };

      const newEdge = {
        id: `e-${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        sourceHandle: sourceHandleId,
        target: newNodeId,
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
        type: 'customStep',
      };

      layoutAllNodes([...nodes, newNode], [...edges, newEdge]);
    }

    closeMenu();
  }, [menuEdge, activeSourceHandle, insertMode, nodes, edges, layoutAllNodes, closeMenu]);

  return {
    menuEdge,
    setMenuEdge,
    activeSourceHandle,
    setActiveSourceHandle,
    insertMode,
    setInsertMode,
    menuPortalPosition,
    setMenuPortalPosition,
    handleInsertNode,
    closeMenu,
  };
}
