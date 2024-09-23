import { useMutation } from "react-query";
import { GraphsService } from "@/client/services/GraphsService";
import { GraphUpdate } from "@/client/models/GraphUpdate";
import { ApiError } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";

export function useGraphMutation(teamId: number, graphId: number | undefined) {
  const showToast = useCustomToast();

  const updateGraph = async (data: GraphUpdate) => {
    if (!graphId) {
      throw new Error("No graph found for this team");
    }
    return await GraphsService.updateGraph({
      teamId,
      id: graphId,
      requestBody: data,
    });
  };

  return useMutation(updateGraph, {
    onSuccess: () => {
      showToast("Success!", "Graph updated.", "success");
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail || "An error occurred";
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
  });
}