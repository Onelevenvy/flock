import { Box } from "@chakra-ui/react";
import React from "react";

import SharedNodeMenu from "./SharedNodeMenu";

const NodePalette: React.FC = () => {
  const onNodeSelect = () => {}; // This is not used for draggable nodes

  return (
    <Box h="full" maxH="full" bg="#fcfcfd" borderTopLeftRadius="lg" >
      <SharedNodeMenu onNodeSelect={onNodeSelect} isDraggable={true} />
    </Box>
  );
};

export default NodePalette;
