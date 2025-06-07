// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

"use client"

import * as React from "react"
import { Tabs as ChakraTabs, TabList as ChakraTabList, TabPanels as ChakraTabPanels, Tab as ChakraTab, TabPanel as ChakraTabPanel, TabsProps as ChakraTabsProps } from "@chakra-ui/react"

export interface TabsProps extends ChakraTabsProps {
  value?: string | number
  onValueChange?: (value: string | number) => void
  defaultValue?: string | number
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, defaultValue, children, ...props }, ref) => {
    return (
      <ChakraTabs
        ref={ref}
        index={typeof value === 'string' ? parseInt(value) : value}
        onChange={(index) => onValueChange?.(index)}
        defaultIndex={typeof defaultValue === 'string' ? parseInt(defaultValue) : defaultValue}
        className={className}
        {...props}
      >
        {children}
      </ChakraTabs>
    )
  }
)

const TabsList = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof ChakraTabList>>(
  ({ className, ...props }, ref) => (
    <ChakraTabList
      ref={ref}
      className={className}
      {...props}
    />
  )
)

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof ChakraTab>>(
  ({ className, ...props }, ref) => (
    <ChakraTab
      ref={ref}
      className={className}
      {...props}
    />
  )
)

const TabsContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof ChakraTabPanel>>(
  ({ className, ...props }, ref) => (
    <ChakraTabPanel
      ref={ref}
      className={className}
      {...props}
    />
  )
)

Tabs.displayName = "Tabs"
TabsList.displayName = "TabsList"
TabsTrigger.displayName = "TabsTrigger"
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
