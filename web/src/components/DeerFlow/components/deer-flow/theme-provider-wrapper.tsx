// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { usePathname } from "next/navigation";

import { ThemeProvider } from "@/components/DeerFlow/components/theme-provider";

export function ThemeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith("/chat");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={"light"}
      enableSystem={isChatPage}
      forcedTheme={isChatPage ? undefined : "light"}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
