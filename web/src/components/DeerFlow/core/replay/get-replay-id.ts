// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

export function extractReplayIdFromSearchParams(params: string) {
  const urlParams = new URLSearchParams(params);
  if (urlParams.has("replay")) {
    return urlParams.get("replay");
  }
  return null;
}
