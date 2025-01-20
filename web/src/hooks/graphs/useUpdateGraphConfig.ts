import { useCallback } from "react";
import { type Edge } from "reactflow";
import type { GraphUpdate } from "@/client/models/GraphUpdate";
import useCustomToast from "@/hooks/useCustomToast";
import { useGraphMutation } from "./useGraphMutation";
import type { CustomNode } from "../../components/WorkFlow/types";
import { generateGraphConfig } from "./graphConfigGenerator";

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
    return generateGraphConfig(nodes, edges);
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
