import { useCallback } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  MarkerType,
} from 'reactflow';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { useWorkflowStore } from '@/store/workflowStore';


/**
 * Standard ReactFlow event handlers: nodes/edges change, connect, validation,
 * node click, and pane click.
 */
export function useFlowHandlers(
  nodes: Node[],
  setNodes: (updater: (nds: Node[]) => Node[]) => void,
  edges: Edge[],
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void,
  setSelectedNodeId: (id: string | null) => void,
  setShowNodePalette: (v: boolean) => void,
) {
  const debugTarget = useWorkflowStore((s) => s.debugTarget);
  const setDebugTarget = useWorkflowStore((s) => s.setDebugTarget);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { strokeWidth: 1.8, stroke: 'rgba(21, 90, 239, 0.25)' },
            type: 'customStep',
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return false;
      const src = nodes.find((n) => n.id === connection.source);
      const tgt = nodes.find((n) => n.id === connection.target);
      if (!src || !tgt) return false;

      const srcCfg = nodeConfig[src.type as NodeType];
      const tgtCfg = nodeConfig[tgt.type as NodeType];
      if (!srcCfg || !tgtCfg) return true;

      if (src.type === 'classifier' || src.type === 'ifelse' || src.type === 'human') {
        return tgtCfg.allowedConnections.targets.length > 0;
      }
      const srcOk = !connection.sourceHandle || srcCfg.allowedConnections.sources.includes(connection.sourceHandle);
      const tgtOk = !connection.targetHandle || tgtCfg.allowedConnections.targets.includes(connection.targetHandle);
      return srcOk && tgtOk;
    },
    [nodes]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setShowNodePalette(false);
      if (debugTarget && node.type !== 'start' && node.type !== 'end') {
        setDebugTarget({ nodeId: node.id });
      }
    },
    [setSelectedNodeId, setShowNodePalette, debugTarget, setDebugTarget]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setShowNodePalette(false);
  }, [setSelectedNodeId, setShowNodePalette]);

  return { onNodesChange, onEdgesChange, onConnect, isValidConnection, onNodeClick, onPaneClick };
}
