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
      bg="#fcfcfd"
      borderTopLeftRadius="lg"
      position="relative"
      transition="all 0.3s ease"
      width={isCollapsed ? "0" : "200px"}
      minWidth={isCollapsed ? "0" : "200px"}
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
        _hover={{ bg: "white" }}
      />

      <Box
        overflow="hidden"
        h="full"
        opacity={isCollapsed ? 0 : 1}
        visibility={isCollapsed ? "hidden" : "visible"}
        transition="all 0.2s ease"
        pointerEvents={isCollapsed ? "none" : "auto"}
      >
        <SharedNodeMenu onNodeSelect={onNodeSelect} isDraggable={true} />
      </Box>
    </Box>
  );
};

export default NodePalette;
