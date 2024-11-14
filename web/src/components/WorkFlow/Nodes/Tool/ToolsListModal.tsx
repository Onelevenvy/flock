import { SearchIcon } from "@chakra-ui/icons";
import {
  Button,
  HStack,
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
  IconButton,
} from "@chakra-ui/react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaTools } from "react-icons/fa";

import ToolsIcon from "@/components/Icons/Tools";
import type { SkillOut } from "@/client";

interface ToolsListProps {
  skills: SkillOut[];
  onClose: () => void;
  onAddTool: (tool: string) => void;
  selectedTools: string[];
}

const ToolsList: React.FC<ToolsListProps> = ({
  skills,
  onClose,
  onAddTool,
  selectedTools,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) =>
      skill.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [skills, searchQuery]);

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
              _hover={{ bg: "blue.100" }}
            >
              <FaTools size="20px" />
            </Box>
            <Text fontSize="lg" fontWeight="600" color="gray.800">
              {t("workflow.nodes.tool.addTool")}
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
                placeholder={
                  t("workflow.nodes.tool.searchTools") || "Search tools..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="lg"
                borderColor="gray.200"
                _hover={{ borderColor: "blue.200" }}
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
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
              {filteredSkills.map((skill) => (
                <Box
                  key={skill.id}
                  p={3}
                  bg="gray.50"
                  borderRadius="lg"
                  borderLeft="3px solid"
                  borderLeftColor="blue.400"
                  transition="all 0.2s"
                  _hover={{
                    bg: "gray.100",
                    borderLeftColor: "blue.500",
                    transform: "translateX(2px)",
                    shadow: "sm",
                  }}
                >
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Box
                        as={IconButton}
                        p={2}
                        borderRadius="lg"
                        bg="blue.50"
                        transition="all 0.2s"
                        _hover={{ bg: "blue.100" }}
                      >
                        <ToolsIcon
                          tools_name={skill.display_name!.replace(/ /g, "_")}
                          color="blue.500"
                          boxSize={4}
                        />
                      </Box>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="500" color="gray.700">
                          {skill.display_name}
                        </Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                          {skill.description}
                        </Text>
                      </VStack>
                    </HStack>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="ghost"
                      onClick={() => onAddTool(skill.display_name!)}
                      isDisabled={selectedTools.includes(skill.display_name!)}
                      minWidth="80px"
                      transition="all 0.2s"
                      _hover={{
                        transform: "translateY(-1px)",
                        shadow: "sm",
                      }}
                    >
                      {selectedTools.includes(skill.display_name!)
                        ? t("workflow.nodes.tool.added")
                        : t("workflow.common.add")}
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

export default ToolsList;
