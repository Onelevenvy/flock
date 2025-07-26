import { useQuery } from "react-query";

import { ToolproviderService } from "@/client/services/ToolproviderService";

export function useToolProvidersQuery() {
  return useQuery("toolproviders", () => ToolproviderService.readProviderListWithTools(), {
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
} 