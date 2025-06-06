// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { cn } from "@/components/DeerFlow/lib/utils";

import styles from "./rainbow-text.module.css";

export function RainbowText({
  animated,
  className,
  children,
}: {
  animated?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn(animated && styles.animated, className)}>
      {children}
    </span>
  );
}
