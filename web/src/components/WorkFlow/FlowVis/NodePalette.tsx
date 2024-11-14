import { Box, IconButton } from "@chakra-ui/react";
import React, { useState } from "react";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";
import { RiMenuUnfoldFill } from "react-icons/ri";

import SharedNodeMenu from "./SharedNodeMenu";

const NodePalette: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const onNodeSelect = () => {}; // This is not used for draggable nodes

  return (
    <Box
      position="relative"
      display="flex"
      h="full"
      maxH="full"
      transition="all 0.3s ease"
    >
      {/* 主面板 */}
      <Box
        h="full"
        maxH="full"
        bg="white"
        borderRadius="xl"
        transition="all 0.3s ease"
        width={isCollapsed ? "0" : "200px"}
        minWidth={isCollapsed ? "0" : "200px"}
        border="1px solid"
        borderColor="gray.100"
        overflow="hidden"
        boxShadow="sm"
        _hover={{
          boxShadow: "md",
        }}
      >
        <Box
          overflow="hidden"
          h="full"
          opacity={isCollapsed ? 0 : 1}
          visibility={isCollapsed ? "hidden" : "visible"}
          transition="all 0.3s ease"
          pointerEvents={isCollapsed ? "none" : "auto"}
        >
          <SharedNodeMenu onNodeSelect={onNodeSelect} isDraggable={true} />
        </Box>
      </Box>

      {/* 折叠/展开按钮 - 独立于主面板 */}
      <Box
        position="absolute"
        left={isCollapsed ? "4px" : "188px"}
        top="36px"
        zIndex={2}
        transition="all 0.3s ease"
      >
        <IconButton
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          icon={
            isCollapsed ? (
              <RiMenuUnfoldFill size="20px" />
            ) : (
              <MdKeyboardDoubleArrowLeft size="20px" />
            )
          }
          size="sm"
          colorScheme="gray"
          onClick={() => setIsCollapsed(!isCollapsed)}
          borderRadius="full"
          boxShadow="lg"
          bg="white"
          color="gray.600"
          transition="all 0.2s"
          _hover={{ 
            bg: "gray.50",
            transform: "scale(1.1)",
            color: "ui.main",
          }}
          _active={{
            bg: "gray.100",
            transform: "scale(0.95)",
          }}
        />
      </Box>
    </Box>
  );
};

export default NodePalette;
