// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { Button } from "@/components/DeerFlow/components/ui/button";
import { Sun } from "lucide-react";

export function ThemeToggle() {
  return (
    <Button variant="ghost" size="icon" className="text-gray-600">
      <Sun className="size-4" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
