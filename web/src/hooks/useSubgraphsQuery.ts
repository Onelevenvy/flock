import { useQuery } from "react-query";
import { SubgraphsService } from "@/client/services/SubgraphsService";

export function useSubgraphsQuery() {
  return useQuery(
    "subgraphs",
    () => SubgraphsService.readAllPublicSubgraphs({ skip: 0, limit: 100 }),
    {
      staleTime: 1 * 60 * 1000, // 1 minute
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );
}
