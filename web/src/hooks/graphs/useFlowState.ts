import { useCallback, useState } from "react";
import {
  type Connection,
  type Edge,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";

import type { CustomNode } from "../../components/WorkFlow/types";

export function useFlowState(initialNodes: CustomNode[], initialEdges: Edge[]) {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, []);
  const onNodeDataChange = useCallback(
    (nodeId: string, key: string, value: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            if (key === "label") {
              // Check if the new name already exists
              const isNameExists = nds.some(
                (n) => n.id !== nodeId && n.data.label === value,
              );

              if (isNameExists) {
                setNameError("Node name already exists");

                return node;
              }
              setNameError(null);
            }

            return {
              ...node,
              data: {
                ...node.data,
                [key]: value,
              },
            };
          }

          return node;
        }),
      );
    },
    [setNodes],
  );

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDataChange,
    nameError,
  };
}
