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
        <Text fontWeight="bold">Knowledge Bases:</Text>
        {node.data.tools?.map((kb: string | KBInfo) => {
          const kbName = typeof kb === "string" ? kb : kb.name;

          return (
            <HStack key={kbName} justifyContent="space-between">
              <Box bg="#f2f4f7" borderRadius="md" w="full" p="1" m="0.5">
                <HStack spacing={"2"}>
                <IconButton
                    aria-label="db"
                    icon={<GiArchiveResearch size={"16px"} />}
                    colorScheme={"pink"}
                    size="xs"
                  />
                  <Text fontWeight={"bold"}>{kbName}</Text>
                </HStack>
              </Box>
              <IconButton
                aria-label="Remove knowledge base"
                icon={<DeleteIcon />}
                size="sm"
                onClick={() => removeKB(kbName)}
              />
            </HStack>
          );
        })}
        <Button onClick={() => setIsKBListOpen(true)} mt={2}>
          Add 
        </Button>
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
