"use client";

import { Box } from "@chakra-ui/react";
import { ReactFlowProvider } from "reactflow";

import type { GraphsOut } from "@/client";

import FlowVisualizer from "./FlowVis/FlowVisualizer";
import { nodeTypes } from "./Nodes";

export default function TqxWorkflow({
  graphData,
  teamId,
}: {
  graphData: GraphsOut;
  teamId: number;
}) {
  return (
    <Box h="full" w="full" >
      <ReactFlowProvider>
        <FlowVisualizer
          teamId={teamId}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ type: "default" }}
          graphData={graphData}
        />
      </ReactFlowProvider>
    </Box>
  );
}
