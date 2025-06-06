// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/components/DeerFlow/lib/utils";

export function RollingText({
  className,
  children,
}: {
  className?: string;
  children?: string | string[];
}) {
  return (
    <span
      className={cn(
        "relative flex h-[2em] items-center overflow-hidden",
        className,
      )}
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          className="absolute w-fit"
          style={{ transition: "all 0.3s ease-in-out" }}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </span>
  );
}
