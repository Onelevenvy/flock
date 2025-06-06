// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { useMemo } from "react";
import { Box } from "@chakra-ui/react";

import { useStore } from "@/components/DeerFlow/core/store";
import { cn } from "@/components/DeerFlow/lib/utils";

import { MessagesBlock } from "./components/messages-block";
import { ResearchBlock } from "./components/research-block";

export default function Main() {
  const openResearchId = useStore((state) => state.openResearchId);
  const doubleColumnMode = useMemo(
    () => openResearchId !== null,
    [openResearchId],
  );
  return (
    <Box
      className={cn(
        "flex h-full w-full justify-center-safe",
        doubleColumnMode && "gap-8",
      )}
    >
      <Box
        className={cn(
          "shrink-0 transition-all duration-300 ease-out rounded-lg shadow-sm overflow-hidden flex flex-col",
          !doubleColumnMode &&
            `w-[768px] translate-x-[min(max(calc((100vw-538px)*0.75),575px)/2,960px/2)]`,
          doubleColumnMode && `w-[538px]`,
        )}
        bg="white"
        borderWidth="1px"
        borderColor="gray.100"
      >
        <MessagesBlock />
      </Box>
      <Box
        className={cn(
          "w-[min(max(calc((100vw-538px)*0.75),575px),960px)] pb-4 transition-all duration-300 ease-out rounded-lg shadow-sm",
          !doubleColumnMode && "scale-0",
          doubleColumnMode && "",
        )}
        bg="white"
        borderWidth="1px"
        borderColor="gray.100"
      >
        <ResearchBlock researchId={openResearchId} />
      </Box>
    </Box>
  );
}
