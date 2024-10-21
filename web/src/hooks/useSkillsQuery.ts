import { useQuery } from "react-query";

import { ToolsService } from "@/client/services/ToolsService";

export function useSkillsQuery() {
  return useQuery("skills", () => ToolsService.readSkills({}), {
    staleTime: 1 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
