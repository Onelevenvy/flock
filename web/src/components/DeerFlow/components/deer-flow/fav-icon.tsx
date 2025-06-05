// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { cn } from "@/components/DeerFlow/lib/utils";

export function FavIcon({
  className,
  url,
  title,
}: {
  className?: string;
  url: string;
  title?: string;
}) {
  return (
    <img
      className={cn("bg-accent h-4 w-4 rounded-full shadow-sm", className)}
      width={16}
      height={16}
      src={new URL(url).origin + "/favicon.ico"}
      alt={title}
      onError={(e) => {
        e.currentTarget.src =
          "https://perishablepress.com/wp/wp-content/images/2021/favicon-standard.png";
      }}
    />
  );
}
