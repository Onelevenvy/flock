import { Text, VStack } from "@chakra-ui/react";
import type React from "react";
import { useSubgraphsQuery } from "@/hooks/useSubgraphsQuery";

interface SubgraphNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const SubgraphNodeProperties: React.FC<SubgraphNodePropertiesProps> = ({
  node,
}) => {
  const { data: subgraphs, isLoading, error } = useSubgraphsQuery();

  console.log("Node data:", node.data);
  console.log("Subgraphs data:", subgraphs?.data);

  const subgraph = subgraphs?.data.find(
    (subgraph) => subgraph.id === node.data.subgraphId
  );

  console.log("Found subgraph:", subgraph);

  if (isLoading) {
    return (
      <VStack align="stretch" spacing={4}>
        <Text>Loading...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack align="stretch" spacing={4}>
        <Text color="red.500">Error loading subgraph data</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Name
        </Text>
        <Text
          color="gray.600"
          fontSize="sm"
          bg="gray.50"
          p={2}
          borderRadius="md"
        >
          {node.data.label}
        </Text>
      </VStack>

      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Description
        </Text>
        <Text
          color="gray.600"
          fontSize="sm"
          bg="gray.50"
          p={2}
          borderRadius="md"
          whiteSpace="pre-wrap"
        >
          {subgraph?.description || "No description available"}
        </Text>
      </VStack>

      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Subgraph ID
        </Text>
        <Text
          color="gray.600"
          fontSize="sm"
          bg="gray.50"
          p={2}
          borderRadius="md"
        >
          {subgraph?.id || "Not found"}
        </Text>
      </VStack>
    </VStack>
  );
};

export default SubgraphNodeProperties;
