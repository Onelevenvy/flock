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
  Switch,
  Button,
  Box,
  FormErrorMessage,
  HStack,
  IconButton,
  Text,
  Divider,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { DeleteIcon } from "@chakra-ui/icons";
import { FaTools, FaRobot } from "react-icons/fa";

import { AgentConfig } from "../../types";
import { DEFAULT_MANAGER } from "./constants";
import { v4 } from "uuid";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import ToolsIcon from "@/components/Icons/Tools";
import ToolsList from "../Tool/ToolsListModal";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import VariableSelector from "../../Common/VariableSelector";
import { VariableReference } from "../../FlowVis/variableSystem";

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agent: AgentConfig) => void;
  initialData?: AgentConfig;
  isManager?: boolean;
  existingAgentNames: string[];
  availableVariables: VariableReference[];
}

const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isManager = false,
  existingAgentNames,
  availableVariables,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
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

  const roleVariableHook = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => setValue("role", value),
    availableVariables,
  });

  const goalVariableHook = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => setValue("goal", value),
    availableVariables,
  });

  const backstoryVariableHook = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => setValue("backstory", value),
    availableVariables,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <FaRobot size="20px" color="#4A5568" />
            <Text>
              {isManager
                ? "Configure Manager Agent"
                : initialData
                  ? "Edit Agent"
                  : "Add Agent"}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel fontWeight="500">Agent Name</FormLabel>
                <Input
                  {...register("name", {
                    required: "Agent name is required",
                    validate: validateUniqueName,
                  })}
                  placeholder="Enter a unique agent name"
                  borderColor="gray.200"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{ borderColor: "blue.500", boxShadow: "none" }}
                />
                <FormErrorMessage>
                  {errors.name && errors.name.message}
                </FormErrorMessage>
              </FormControl>

              <VariableSelector
                label="Role"
                value={watch("role") || ""}
                onChange={(value) => setValue("role", value)}
                placeholder={isManager ? "Crew Manager" : "e.g., Research Specialist"}
                showVariables={roleVariableHook.showVariables}
                setShowVariables={roleVariableHook.setShowVariables}
                inputRef={roleVariableHook.inputRef}
                handleKeyDown={roleVariableHook.handleKeyDown}
                insertVariable={roleVariableHook.insertVariable}
                availableVariables={availableVariables}
                minHeight="80px"
              />

              <VariableSelector
                label="Goal"
                value={watch("goal") || ""}
                onChange={(value) => setValue("goal", value)}
                placeholder="Agent's primary objective"
                showVariables={goalVariableHook.showVariables}
                setShowVariables={goalVariableHook.setShowVariables}
                inputRef={goalVariableHook.inputRef}
                handleKeyDown={goalVariableHook.handleKeyDown}
                insertVariable={goalVariableHook.insertVariable}
                availableVariables={availableVariables}
                minHeight="80px"
              />

              <VariableSelector
                label="Backstory"
                value={watch("backstory") || ""}
                onChange={(value) => setValue("backstory", value)}
                placeholder="Agent's background and expertise"
                showVariables={backstoryVariableHook.showVariables}
                setShowVariables={backstoryVariableHook.setShowVariables}
                inputRef={backstoryVariableHook.inputRef}
                handleKeyDown={backstoryVariableHook.handleKeyDown}
                insertVariable={backstoryVariableHook.insertVariable}
                availableVariables={availableVariables}
                minHeight="120px"
              />

              {!isManager && (
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" fontWeight="500">
                    Allow Delegation
                  </FormLabel>
                  <Switch {...register("allow_delegation")} colorScheme="blue" />
                </FormControl>
              )}

              <Divider />

              <Box>
                <HStack justify="space-between" align="center" mb={3}>
                  <HStack spacing={2}>
                    <FaTools size="14px" color="#4A5568" />
                    <Text fontSize="md" fontWeight="600" color="gray.700">
                      Tools
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      ({selectedTools.length})
                    </Text>
                  </HStack>
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<FaTools size="12px" />}
                    onClick={() => setIsToolsListOpen(true)}
                    colorScheme="blue"
                  >
                    Add Tool
                  </Button>
                </HStack>

                <VStack align="stretch" spacing={2}>
                  {selectedTools.map((tool) => (
                    <Box
                      key={tool}
                      p={2}
                      bg="gray.50"
                      borderRadius="md"
                      borderLeft="3px solid"
                      borderLeftColor="blue.400"
                      transition="all 0.2s"
                      _hover={{
                        bg: "gray.100",
                        borderLeftColor: "blue.500",
                      }}
                    >
                      <HStack justify="space-between" align="center">
                        <HStack spacing={2}>
                          <ToolsIcon tools_name={tool.replace(/ /g, "_")} />
                          <Text fontSize="sm" fontWeight="500">
                            {tool}
                          </Text>
                        </HStack>
                        <IconButton
                          aria-label="Remove tool"
                          icon={<DeleteIcon />}
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => removeTool(tool)}
                        />
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              </Box>

              <Button
                type="submit"
                colorScheme="blue"
                size="md"
                width="100%"
                mt={4}
              >
                {isManager
                  ? "Save Manager Configuration"
                  : initialData
                    ? "Update Agent"
                    : "Add Agent"}
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
