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
      h="full"
      maxH="full"
      bg="white"
      borderRadius="xl"
      position="relative"
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
      <IconButton
        aria-label={isCollapsed ? "Expand" : "Collapse"}
        icon={
          isCollapsed ? (
            <RiMenuUnfoldFill size="20px" />
          ) : (
            <MdKeyboardDoubleArrowLeft size="20px" />
          )
        }
        position="absolute"
        right={isCollapsed ? "-32px" : "-12px"}
        top="25px"
        size="sm"
        zIndex={2}
        colorScheme="gray"
        onClick={() => setIsCollapsed(!isCollapsed)}
        borderRadius="full"
        boxShadow="md"
        bg="white"
        transition="all 0.2s"
        _hover={{ 
          bg: "gray.50",
          transform: "scale(1.1)",
        }}
        _active={{
          bg: "gray.100",
          transform: "scale(1)",
        }}
      />

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
  );
};

export default NodePalette;
