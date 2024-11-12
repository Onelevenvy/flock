import { useCallback } from "react";
import { type Edge } from "reactflow";
import { v4 } from "uuid";

import type { GraphUpdate } from "@/client/models/GraphUpdate";
import useCustomToast from "@/hooks/useCustomToast";

import { useGraphMutation } from "./useGraphMutation";
import {
  type NodeType,
  nodeConfig,
} from "../../components/WorkFlow/Nodes/nodeConfig";
import type { CustomNode } from "../../components/WorkFlow/types";

export function useGraphConfig(
  teamId: number,
  graphId: number | undefined,
  graphName: string | undefined,
  graphDescription: string | undefined | null,
  nodes: CustomNode[],
  edges: Edge[]
) {
  const showToast = useCustomToast();
  const mutation = useGraphMutation(teamId, graphId);

  const saveConfig = useCallback((): Record<string, any> => {
    const startEdge = edges.find((edge) => {
      const sourceNode = nodes.find(
        (node) => node.id === edge.source && node.type === "start"
      );

      return sourceNode !== undefined;
    });

    const entryPointId = startEdge ? startEdge.target : null;

    return {
      id: v4(),
      name: "Flow Visualization",
      nodes: nodes.map((node) => {
        const nodeType = node.type as NodeType;
        const initialData = nodeConfig[nodeType].initialData || {};
        const nodeData: Record<string, any> = {
          ...node.data,
          label: node.data.label,
        };

        Object.keys(initialData).forEach((key) => {
          if (node.data[key] !== undefined) {
            nodeData[key] = node.data[key];
          }
        });

        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: nodeData,
        };
      }),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || "bottom",
        targetHandle: edge.targetHandle || "top",
        type: edge.type,
      })),
      metadata: {
        entry_point: entryPointId,
        start_connections: edges
          .filter((edge) =>
            nodes.find(
              (node) => node.id === edge.source && node.type === "start"
            )
          )
          .map((edge) => ({
            target: edge.target,
            type: edge.type,
          })),
        end_connections: edges
          .filter((edge) =>
            nodes.find((node) => node.id === edge.target && node.type === "end")
          )
          .map((edge) => ({
            source: edge.source,
            type: edge.type,
          })),
      },
    };
  }, [nodes, edges]);

  const onSave = useCallback(() => {
    if (!graphId) {
      showToast(
        "Something went wrong.",
        "No graph found for this team",
        "error"
      );

      return;
    }

    const config = saveConfig();
    const currentDate = new Date().toISOString();

    const updateData: GraphUpdate = {
      name: graphName,
      description: graphDescription,
      config: config,
      updated_at: currentDate,
    };

    mutation.mutate(updateData);
  }, [graphId, graphName, graphDescription, saveConfig, mutation, showToast]);

  return {
    onSave,
    isLoading: mutation.isLoading,
  };
}
