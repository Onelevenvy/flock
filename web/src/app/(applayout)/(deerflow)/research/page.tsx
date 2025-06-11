// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import dynamic from "next/dynamic";
import { Box, Flex } from "@chakra-ui/react";
import { Suspense } from "react";
// import { ThemeToggle } from "@/components/DeerFlow/components/deer-flow/theme-toggle";
import { SettingsDialog } from "../settings/dialogs/settings-dialog";

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
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Flex
        h="12"
        px="4"
        alignItems="center"
        justifyContent="flex-end"
        borderBottom="1px"
        borderColor="gray.100"
        bg="white"
        flexShrink={0}
      >
        <Flex gap="2">
          {/* <ThemeToggle /> */}
          <Suspense>
            <SettingsDialog />
          </Suspense>
        </Flex>
      </Flex>
      <Box flex="1" p="4" overflow="hidden">
        <Main />
      </Box>
    </Box>
  );
}
