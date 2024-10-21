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
} from "@chakra-ui/react";
import type React from "react";
import { useMemo, useState } from "react";

import type { SkillOut } from "@/client";
import ToolsIcon from "@/components/Icons/Tools";

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
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>添加工具</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="搜索工具..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
            {filteredSkills.map((skill) => (
              <HStack key={skill.id} justifyContent="space-between">
                <HStack spacing={"2"}>
                  <ToolsIcon
                    tools_name={skill.display_name!.replace(/ /g, "_")}
                    ml="2"
                  />
                  <Text>{skill.display_name}</Text>
                </HStack>

                <Button
                  size="sm"
                  onClick={() => onAddTool(skill.display_name!)}
                  isDisabled={selectedTools.includes(skill.display_name!)}
                >
                  {selectedTools.includes(skill.display_name!)
                    ? "已添加"
                    : "添加"}
                </Button>
              </HStack>
            ))}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ToolsList;
