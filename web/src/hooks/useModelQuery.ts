import { useQuery } from "react-query";

import { ModelService } from "@/client/services/ModelService";

export function useModelQuery() {
  return useQuery("model", () => ModelService.readModels(), {
    staleTime: 0.5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
