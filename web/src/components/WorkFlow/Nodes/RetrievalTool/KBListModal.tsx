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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) =>
      upload.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [uploads, searchQuery]);

  return (
    <Modal isOpen={true} onClose={onClose} size="md">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        borderRadius="xl"
        boxShadow="xl"
        bg="white"
        overflow="hidden"
        mx={4}
        my={4}
      >
        <ModalHeader>
          <HStack spacing={2}>
            <Box
              p={2}
              borderRadius="lg"
              bg="blue.50"
              color="blue.500"
              transition="all 0.2s"
              _hover={{ bg: "teal.100" }}
            >
              <GiArchiveResearch size="20px" />
            </Box>
            <Text fontSize="lg" fontWeight="600" color="gray.800">
              {t("workflow.nodes.retrieval.addKB")}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton
          position="absolute"
          right={4}
          top={4}
          borderRadius="full"
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "rotate(90deg)",
          }}
        />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder={String(t("workflow.nodes.retrieval.searchKB"))}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="lg"
                borderColor="gray.200"
                _hover={{ borderColor: "teal.200" }}
                _focus={{
                  borderColor: "teal.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-teal-500)",
                }}
                transition="all 0.2s"
              />
            </InputGroup>
            <VStack
              align="stretch"
              spacing={2}
              maxH="400px"
              overflowY="auto"
              overflowX="hidden"
              sx={{
                "&::-webkit-scrollbar": {
                  width: "4px",
                },
                "&::-webkit-scrollbar-track": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "gray.200",
                  borderRadius: "24px",
                },
              }}
            >
              {filteredUploads.map((upload) => (
                <Box
                  key={upload.id}
                  p={3}
                  bg="gray.50"
                  borderRadius="lg"
                  borderLeft="3px solid"
                  borderLeftColor="blue.400"
                  transition="all 0.2s"
                  _hover={{
                    bg: "gray.100",
                    borderLeftColor: "teal.500",
                    transform: "translateX(2px)",
                    shadow: "sm",
                  }}
                >
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <IconButton
                        aria-label="db"
                        icon={<GiArchiveResearch size="16px" />}
                        colorScheme="blue"
                        size="sm"
                        variant="ghost"
                        transition="all 0.2s"
                        _hover={{
                          transform: "scale(1.1)",
                        }}
                      />
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="500" color="gray.700">
                          {upload.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={2}>
                          {upload.description ||
                            t("workflow.nodes.retrieval.noDescription")}
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
                      minWidth="80px"
                      transition="all 0.2s"
                      _hover={{
                        transform: "translateY(-1px)",
                        shadow: "sm",
                      }}
                    >
                      {selectedKBs.includes(upload.name)
                        ? t("workflow.nodes.retrieval.added")
                        : t("workflow.common.add")}
                    </Button>
                  </HStack>
                </Box>
              ))}
              {filteredUploads.length === 0 && (
                <Box
                  p={4}
                  textAlign="center"
                  color="gray.500"
                  fontSize="sm"
                  fontWeight="500"
                >
                  {t("workflow.nodes.retrieval.noResults")}
                </Box>
              )}
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default KBListModal;
