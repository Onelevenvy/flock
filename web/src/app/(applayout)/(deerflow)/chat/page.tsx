// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import dynamic from "next/dynamic";
import { Box } from "@chakra-ui/react";

const Main = dynamic(() => import("./main"), {
  ssr: false,
  loading: () => (
    <Box 
      display="flex" 
      h="full" 
      w="full" 
      alignItems="center" 
      justifyContent="center"
      bg="ui.bgMain"
    >
      Loading DeerFlow...
    </Box>
  ),
});

export default function ChatPage() {
  return (
    <Box 
      h="full" 
      w="full" 
      bg="ui.bgMain" 
      p={4}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Main />
    </Box>
  );
}
