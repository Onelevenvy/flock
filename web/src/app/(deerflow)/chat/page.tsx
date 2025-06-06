// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client";

import { GithubOutlined } from "@ant-design/icons";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/DeerFlow/components/ui/button";

import { Logo } from "@/components/DeerFlow/components/deer-flow/logo";
import { ThemeToggle } from "@/components/DeerFlow/components/deer-flow/theme-toggle";
import { Tooltip } from "@/components/DeerFlow/components/deer-flow/tooltip";
import { SettingsDialog } from "../settings/dialogs/settings-dialog";

const Main = dynamic(() => import("./main"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      Loading DeerFlow...
    </div>
  ),
});

export default function HomePage() {
  return (
    <div className="flex h-screen w-screen justify-center overscroll-none bg-app">
      <header className="fixed top-0 left-0 z-50 flex h-12 w-full items-center justify-between border-b border-[var(--component-border)] bg-background/80 px-4 backdrop-blur-sm">
        <Logo />
        <div className="flex items-center gap-2">
          <Tooltip title="Star DeerFlow on GitHub">
            <Button variant="ghost" size="icon" className="hover:bg-accent" asChild>
              <Link
                href="https://github.com/bytedance/deer-flow"
                target="_blank"
              >
                <GithubOutlined />
              </Link>
            </Button>
          </Tooltip>
          <ThemeToggle />
          <Suspense>
            <SettingsDialog />
          </Suspense>
        </div>
      </header>
      <Main />
    </div>
  );
}
