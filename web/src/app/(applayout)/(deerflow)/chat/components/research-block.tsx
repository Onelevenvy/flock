// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { Box, Flex } from "@chakra-ui/react";
import { Check, Copy, Headphones, Pencil, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ScrollContainer } from "@/components/DeerFlow/components/deer-flow/scroll-container";
import { Tooltip } from "@/components/DeerFlow/components/deer-flow/tooltip";
import { Button } from "@/components/DeerFlow/components/ui/button";
import { Card } from "@/components/DeerFlow/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/DeerFlow/components/ui/tabs";
import { useReplay } from "@/components/DeerFlow/core/replay";
import { closeResearch, listenToPodcast, useStore } from "@/components/DeerFlow/core/store";
import { cn } from "@/components/DeerFlow/lib/utils";

import { ResearchActivitiesBlock } from "./research-activities-block";
import { ResearchReportBlock } from "./research-report-block";

export function ResearchBlock({
  className,
  researchId = null,
}: {
  className?: string;
  researchId: string | null;
}) {
  const reportId = useStore((state) =>
    researchId ? state.researchReportIds.get(researchId) : undefined,
  );
  const [activeTab, setActiveTab] = useState("activities");
  const hasReport = useStore((state) =>
    researchId ? state.researchReportIds.has(researchId) : false,
  );
  const reportStreaming = useStore((state) =>
    reportId ? (state.messages.get(reportId)?.isStreaming ?? false) : false,
  );
  const { isReplay } = useReplay();
  useEffect(() => {
    if (hasReport) {
      setActiveTab("report");
    }
  }, [hasReport]);

  const handleGeneratePodcast = useCallback(async () => {
    if (!researchId) {
      return;
    }
    await listenToPodcast(researchId);
  }, [researchId]);

  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (!reportId) {
      return;
    }
    const report = useStore.getState().messages.get(reportId);
    if (!report) {
      return;
    }
    void navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1000);
  }, [reportId]);

  const handleEdit = useCallback(() => {
    setEditing((editing) => !editing);
  }, []);

  // When the research id changes, set the active tab to activities
  useEffect(() => {
    if (!hasReport) {
      setActiveTab("activities");
    }
  }, [hasReport, researchId]);

  return (
    <Box h="full" w="full" className={className}>
      <Card className={cn("relative h-full w-full pt-4", className)}>
        <Box position="absolute" right={4} display="flex" h={9} alignItems="center" justifyContent="center">
          {hasReport && !reportStreaming && (
            <>
              <Tooltip title="Generate podcast">
                <Button
                  className="text-gray-600"
                  size="icon"
                  variant="ghost"
                  disabled={isReplay}
                  onClick={handleGeneratePodcast}
                >
                  <Headphones />
                </Button>
              </Tooltip>
              <Tooltip title="Edit">
                <Button
                  className="text-gray-600"
                  size="icon"
                  variant="ghost"
                  disabled={isReplay}
                  onClick={handleEdit}
                >
                  {editing ? <Undo2 /> : <Pencil />}
                </Button>
              </Tooltip>
              <Tooltip title="Copy">
                <Button
                  className="text-gray-600"
                  size="icon"
                  variant="ghost"
                  onClick={handleCopy}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </Tooltip>
            </>
          )}
          <Tooltip title="Close">
            <Button
              className="text-gray-600"
              size="sm"
              variant="ghost"
              onClick={() => {
                closeResearch();
              }}
            >
              <X />
            </Button>
          </Tooltip>
        </Box>
        <Tabs
          className="flex h-full w-full flex-col"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value)}
        >
          <Flex w="full" justifyContent="center">
            <TabsList>
              <TabsTrigger
                className="px-8"
                value="report"
                disabled={!hasReport}
              >
                Report
              </TabsTrigger>
              <TabsTrigger className="px-8" value="activities">
                Activities
              </TabsTrigger>
            </TabsList>
          </Flex>
          <TabsContent
            className="h-full min-h-0 flex-grow px-8"
            value="report"
            forceMount
            hidden={activeTab !== "report"}
          >
            <ScrollContainer
              className="px-5pb-20 h-full"
              scrollShadowColor="var(--chakra-colors-white)"
              autoScrollToBottom={!hasReport || reportStreaming}
            >
              {reportId && researchId && (
                <ResearchReportBlock
                  className="mt-4"
                  researchId={researchId}
                  messageId={reportId}
                  editing={editing}
                />
              )}
            </ScrollContainer>
          </TabsContent>
          <TabsContent
            className="h-full min-h-0 flex-grow px-8"
            value="activities"
            forceMount
            hidden={activeTab !== "activities"}
          >
            <ScrollContainer
              className="h-full"
              scrollShadowColor="var(--chakra-colors-white)"
              autoScrollToBottom={!hasReport || reportStreaming}
            >
              {researchId && (
                <ResearchActivitiesBlock
                  className="mt-4"
                  researchId={researchId}
                />
              )}
            </ScrollContainer>
          </TabsContent>
        </Tabs>
      </Card>
    </Box>
  );
}
