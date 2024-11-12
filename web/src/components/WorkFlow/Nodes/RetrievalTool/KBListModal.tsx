import { SearchIcon } from "@chakra-ui/icons";
import {
  Button,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  Box,
} from "@chakra-ui/react";
import type React from "react";
import { useMemo, useState } from "react";
import { GiArchiveResearch } from "react-icons/gi";

interface KBInfo {
  name: string;
  description: string;
  usr_id: number;
  kb_id: number;
}

interface KBListProps {
  uploads: any[];
  onClose: () => void;
  onAddKB: (kb: KBInfo) => void;
  selectedKBs: string[];
}

const KBListModal: React.FC<KBListProps> = ({
  uploads,
  onClose,
  onAddKB,
  selectedKBs,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) =>
      upload.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [uploads, searchQuery]);

  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Knowledge Base</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search knowledge bases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderColor="gray.200"
                _hover={{ borderColor: "gray.300" }}
                _focus={{ borderColor: "blue.500", boxShadow: "none" }}
              />
            </InputGroup>
            <VStack align="stretch" spacing={2} maxH="400px" overflowY="auto">
              {filteredUploads.map((upload) => (
                <Box
                  key={upload.id}
                  p={2}
                  borderRadius="md"
                  bg="gray.50"
                  transition="all 0.2s"
                  _hover={{ bg: "gray.100" }}
                >
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <IconButton
                        aria-label="db"
                        icon={<GiArchiveResearch size="16px" />}
                        colorScheme="pink"
                        size="xs"
                        variant="ghost"
                      />
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="500">
                          {upload.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                          {upload.description}
                        </Text>
                      </VStack>
                    </HStack>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="ghost"
                      onClick={() =>
                        onAddKB({
                          name: upload.name,
                          description: upload.description,
                          usr_id: upload.owner_id,
                          kb_id: upload.id,
                        })
                      }
                      isDisabled={selectedKBs.includes(upload.name)}
                    >
                      {selectedKBs.includes(upload.name) ? "Added" : "Add"}
                    </Button>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default KBListModal;
