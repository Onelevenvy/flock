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
} from "@chakra-ui/react";
import type React from "react";
import { useMemo, useState } from "react";

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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) =>
      skill.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [skills, searchQuery]);

  return (
    <Modal isOpen={true} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text fontSize="lg" fontWeight="600">
            Add Tool
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderColor="gray.200"
                _hover={{ borderColor: "gray.300" }}
                _focus={{ borderColor: "blue.500", boxShadow: "none" }}
              />
            </InputGroup>
            <VStack align="stretch" spacing={2} maxH="400px" overflowY="auto">
              {filteredSkills.map((skill) => (
                <Box
                  key={skill.id}
                  p={2}
                  borderRadius="md"
                  bg="gray.50"
                  transition="all 0.2s"
                  _hover={{ bg: "gray.100" }}
                >
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <ToolsIcon
                        tools_name={skill.display_name!.replace(/ /g, "_")}
                      />
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="500">
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
                      width="auto"
                      justifyContent="center"
                    >
                      {selectedTools.includes(skill.display_name!)
                        ? "Added"
                        : "Add"}
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
