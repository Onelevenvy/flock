import { DeleteIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import type React from "react";
import { useState } from "react";
import { GiArchiveResearch } from "react-icons/gi";

import { useUploadsQuery } from "@/hooks/useUploadsQuery";

import KBListModal from "./KBListModal";

interface KBInfo {
  name: string;
  description: string;
  usr_id: number;
  kb_id: number;
}

interface RetrievalToolNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const RetrievalToolNodeProperties: React.FC<
  RetrievalToolNodePropertiesProps
> = ({ node, onNodeDataChange }) => {
  const [isKBListOpen, setIsKBListOpen] = useState(false);
  const { data: uploads, isLoading, isError } = useUploadsQuery();

  const addKB = (kb: KBInfo) => {
    const currentKBs = node.data.tools || [];

    if (
      !currentKBs.some(
        (k: string | KBInfo) => (typeof k === "string" ? k : k.name) === kb.name
      )
    ) {
      onNodeDataChange(node.id, "tools", [...currentKBs, kb]);
    }
  };

  const removeKB = (kbName: string) => {
    const currentKBs = node.data.tools || [];

    onNodeDataChange(
      node.id,
      "tools",
      currentKBs.filter(
        (k: string | KBInfo) => (typeof k === "string" ? k : k.name) !== kbName
      )
    );
  };

  if (isLoading) return <Text>Loading knowledge bases...</Text>;
  if (isError) return <Text>Error loading knowledge bases</Text>;

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <HStack justify="space-between" align="center" mb={3}>
          <HStack spacing={2}>
            <GiArchiveResearch size="14px" color="#4A5568" />
            <Text fontSize="md" fontWeight="600" color="gray.700">
              Knowledge Bases
            </Text>
            <Text fontSize="xs" color="gray.500">
              ({node.data.tools?.length || 0})
            </Text>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<GiArchiveResearch size="12px" />}
            onClick={() => setIsKBListOpen(true)}
            colorScheme="blue"
          >
            Add KB
          </Button>
        </HStack>

        <VStack align="stretch" spacing={2}>
          {node.data.tools?.map((kb: string | KBInfo) => {
            const kbName = typeof kb === 'string' ? kb : kb.name;
            
            return (
              <Box
                key={kbName}
                p={2}
                bg="gray.50"
                borderRadius="md"
                borderLeft="3px solid"
                borderLeftColor="pink.400"
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                  borderLeftColor: "pink.500",
                }}
              >
                <HStack justify="space-between" align="center">
                  <HStack spacing={2}>
                    <IconButton
                      aria-label="db"
                      icon={<GiArchiveResearch size="16px" />}
                      colorScheme="pink"
                      size="xs"
                      variant="ghost"
                    />
                    <Text fontSize="sm" fontWeight="500">
                      {kbName}
                    </Text>
                  </HStack>
                  <IconButton
                    aria-label="Remove knowledge base"
                    icon={<DeleteIcon />}
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => removeKB(kbName)}
                  />
                </HStack>
              </Box>
            );
          })}
        </VStack>
      </Box>

      {isKBListOpen && (
        <KBListModal
          uploads={uploads?.data || []}
          onClose={() => setIsKBListOpen(false)}
          onAddKB={addKB}
          selectedKBs={
            node.data.tools?.map((kb: string | KBInfo) =>
              typeof kb === "string" ? kb : kb.name
            ) || []
          }
        />
      )}
    </VStack>
  );
};

export default RetrievalToolNodeProperties;
