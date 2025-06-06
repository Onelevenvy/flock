// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { EditorBubble, removeAIHighlight, useEditor } from "novel";
import { Fragment, type ReactNode, useEffect } from "react";
import { Button } from "../../ui/button";
import Magic from "../../ui/icons/magic";
import { AISelector } from "./ai-selector";
import { useReplay } from "@/components/DeerFlow/core/replay";
import { TooltipContent, TooltipTrigger } from "@/components/DeerFlow/components/ui/tooltip";
import { Tooltip } from "@/components/DeerFlow/components/ui/tooltip";

interface GenerativeMenuSwitchProps {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const GenerativeMenuSwitch = ({
  children,
  open,
  onOpenChange,
}: GenerativeMenuSwitchProps) => {
  const { editor } = useEditor();
  const { isReplay } = useReplay();
  useEffect(() => {
    if (!open && editor) removeAIHighlight(editor);
  }, [open]);

  if (!editor) return null;
  return (
    <EditorBubble
      tippyOptions={{
        placement: open ? "bottom-start" : "top",
        onHidden: () => {
          onOpenChange(false);
          editor.chain().unsetHighlight().run();
        },
      }}
      className="border-muted bg-background flex w-fit max-w-[90vw] overflow-hidden rounded-md border shadow-xl"
    >
      {open && <AISelector open={open} onOpenChange={onOpenChange} />}
      {!open && (
        <Fragment>
          {isReplay ? (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className="gap-1 rounded-none text-purple-500"
                  variant="ghost"
                  size="sm"
                  disabled
                >
                  <Magic className="h-5 w-5" />
                  Ask AI
                </Button>
              </TooltipTrigger>
              <TooltipContent>You can't ask AI in replay mode.</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              className="gap-1 rounded-none text-purple-500"
              variant="ghost"
              onClick={() => onOpenChange(true)}
              size="sm"
            >
              <Magic className="h-5 w-5" />
              Ask AI
            </Button>
          )}
          {children}
        </Fragment>
      )}
    </EditorBubble>
  );
};

export default GenerativeMenuSwitch;
