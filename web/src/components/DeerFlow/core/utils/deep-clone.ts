// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
