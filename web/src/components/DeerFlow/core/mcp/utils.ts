// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { useSettingsStore } from "../store";

export function findMCPTool(name: string) {
  const mcpServers = useSettingsStore.getState().mcp.servers;
  for (const server of mcpServers) {
    for (const tool of server.tools) {
      if (tool.name === name) {
        return tool;
      }
    }
  }
  return null;
}
