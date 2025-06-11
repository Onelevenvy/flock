// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tooltip } from "@/components/DeerFlow/components/deer-flow/tooltip";
import { Badge } from "@/components/DeerFlow/components/ui/badge";
import { Button } from "@/components/DeerFlow/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/DeerFlow/components/ui/dialog";
import { useReplay } from "@/components/DeerFlow/core/replay";
import {
  type SettingsState,
  changeSettings,
  saveSettings,
  useSettingsStore,
} from "@/components/DeerFlow/core/store";
import { cn } from "@/components/DeerFlow/lib/utils";
import { Box, Flex } from "@chakra-ui/react";

import { SETTINGS_TABS } from "../tabs";

export function SettingsDialog() {
  const { isReplay } = useReplay();
  const [activeTabId, setActiveTabId] = useState(SETTINGS_TABS[0]!.id);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(useSettingsStore.getState());
  const [changes, setChanges] = useState<Partial<SettingsState>>({});

  const handleTabChange = useCallback(
    (newChanges: Partial<SettingsState>) => {
      setTimeout(() => {
        if (open) {
          setChanges((prev) => ({
            ...prev,
            ...newChanges,
          }));
        }
      }, 0);
    },
    [open],
  );

  const handleSave = useCallback(() => {
    if (Object.keys(changes).length > 0) {
      const newSettings: SettingsState = {
        ...settings,
        ...changes,
      };
      setSettings(newSettings);
      setChanges({});
      changeSettings(newSettings);
      saveSettings();
    }
    setOpen(false);
  }, [settings, changes]);

  const handleOpen = useCallback(() => {
    setSettings(useSettingsStore.getState());
  }, []);

  const handleClose = useCallback(() => {
    setChanges({});
  }, []);

  useEffect(() => {
    if (open) {
      handleOpen();
    } else {
      handleClose();
    }
  }, [open, handleOpen, handleClose]);

  const mergedSettings = useMemo<SettingsState>(() => {
    return {
      ...settings,
      ...changes,
    };
  }, [settings, changes]);

  if (isReplay) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip title="Settings">
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings />
          </Button>
        </DialogTrigger>
      </Tooltip>
      <DialogContent className="sm:max-w-[850px]">
        <DialogHeader>
          <DialogTitle>DeerFlow Settings</DialogTitle>
          <DialogDescription>
            Manage your DeerFlow settings here.
          </DialogDescription>
        </DialogHeader>
        <Flex className="h-120 w-full overflow-auto border-y">
          <Box className="flex w-50 shrink-0 border-r p-1">
            <Box className="size-full">
              {SETTINGS_TABS.map((tab) => (
                <Box
                  key={tab.id}
                  className={cn(
                    "hover:accent-foreground hover:bg-accent mb-1 flex h-8 w-full cursor-pointer items-center gap-1.5 rounded px-2",
                    activeTabId === tab.id &&
                      "!bg-primary !text-primary-foreground",
                  )}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-muted-foreground text-muted-foreground ml-auto px-1 py-0 text-xs",
                        activeTabId === tab.id &&
                          "border-primary-foreground text-primary-foreground",
                      )}
                    >
                      {tab.badge}
                    </Badge>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
          <Box className="min-w-0 flex-grow">
            <Box
              id="settings-content-scrollable"
              className="size-full overflow-auto p-4"
            >
              {SETTINGS_TABS.map((tab) => (
                <Box
                  key={tab.id}
                  className={cn(
                    "h-full w-full",
                    activeTabId !== tab.id && "hidden",
                  )}
                >
                  <tab.component
                    settings={mergedSettings}
                    onChange={handleTabChange}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Flex>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="w-24" type="submit" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
