import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Switch,
  Button,
  Box,
  FormErrorMessage,
  HStack,
  IconButton,
  Text,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { DeleteIcon } from "@chakra-ui/icons";

import { AgentConfig } from "../../types";
import { DEFAULT_MANAGER } from "./constants";
import { v4 } from "uuid";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import ToolsIcon from "@/components/Icons/Tools";
import ToolsList from "../Tool/ToolsListModal";

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agent: AgentConfig) => void;
  initialData?: AgentConfig;
  isManager?: boolean;
  existingAgentNames: string[];
}

const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isManager = false,
  existingAgentNames,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AgentConfig>({
    defaultValues: initialData || {
      id: v4(),
      name: "",
      role: isManager ? DEFAULT_MANAGER.role : "",
      goal: isManager ? DEFAULT_MANAGER.goal : "",
      backstory: isManager ? DEFAULT_MANAGER.backstory : "",
      allow_delegation: isManager,
      tools: [],
    },
  });

  const [isToolsListOpen, setIsToolsListOpen] = useState(false);
  const { data: skills, isLoading, isError } = useSkillsQuery();
  const [selectedTools, setSelectedTools] = useState<string[]>(
    initialData?.tools || []
  );

  const validateUniqueName = (value: string) => {
    if (!value) return "Agent name is required";
    if (!initialData && existingAgentNames.includes(value)) {
      return "Agent name must be unique";
    }
    if (
      initialData &&
      existingAgentNames
        .filter((name) => name !== initialData.name)
        .includes(value)
    ) {
      return "Agent name must be unique";
    }
    return true;
  };

  const addTool = (tool: string) => {
    if (!selectedTools.includes(tool)) {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const removeTool = (tool: string) => {
    setSelectedTools(selectedTools.filter((t) => t !== tool));
  };

  const handleFormSubmit = (data: AgentConfig) => {
    onSubmit({
      ...data,
      tools: selectedTools,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isManager
            ? "Configure Manager Agent"
            : initialData
              ? "Edit Agent"
              : "Add Agent"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <VStack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel>Agent Name</FormLabel>
                <Input
                  {...register("name", {
                    required: "Agent name is required",
                    validate: validateUniqueName,
                  })}
                  placeholder="Enter a unique agent name"
                />
                <FormErrorMessage>
                  {errors.name && errors.name.message}
                </FormErrorMessage>
              </FormControl>

              <FormControl>
                <FormLabel>Role</FormLabel>
                <Input
                  {...register("role")}
                  placeholder={
                    isManager ? "Crew Manager" : "e.g., Research Specialist"
                  }
                  isReadOnly={isManager}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Goal</FormLabel>
                <Input
                  {...register("goal")}
                  placeholder="Agent's primary objective"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Backstory</FormLabel>
                <Textarea
                  {...register("backstory")}
                  placeholder="Agent's background and expertise"
                />
              </FormControl>

              {!isManager && (
                <Box w="100%">
                  <FormControl display="flex" alignItems="center" mt={2}>
                    <FormLabel mb="0">Allow Delegation</FormLabel>
                    <Switch {...register("allow_delegation")} />
                  </FormControl>
                </Box>
              )}

              <FormControl>
                <FormLabel>Tools</FormLabel>
                <VStack align="stretch" spacing={2}>
                  {selectedTools.map((tool) => (
                    <HStack key={tool} justifyContent="space-between">
                      <Box bg="#f2f4f7" borderRadius="md" w="full" p="1">
                        <HStack spacing={"2"}>
                          <ToolsIcon
                            tools_name={tool.replace(/ /g, "_")}
                            ml="2"
                          />
                          <Text fontWeight={"bold"}>{tool}</Text>
                        </HStack>
                      </Box>
                      <IconButton
                        aria-label="Remove tool"
                        icon={<DeleteIcon />}
                        size="sm"
                        onClick={() => removeTool(tool)}
                      />
                    </HStack>
                  ))}
                  <Button onClick={() => setIsToolsListOpen(true)} mt={2}>
                    Add Tool
                  </Button>
                </VStack>
              </FormControl>

              <Button type="submit" colorScheme="blue" w="100%">
                {isManager
                  ? "Save Manager Configuration"
                  : initialData
                    ? "Update"
                    : "Add"}{" "}
                Agent
              </Button>
            </VStack>
          </form>

          {isToolsListOpen && (
            <ToolsList
              skills={skills?.data || []}
              onClose={() => setIsToolsListOpen(false)}
              onAddTool={addTool}
              selectedTools={selectedTools}
            />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AgentModal;
