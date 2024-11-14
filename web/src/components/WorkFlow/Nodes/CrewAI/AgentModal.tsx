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
import { FaTools, FaRobot, FaPlus } from "react-icons/fa";

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
              <FaRobot size="20px" />
            </Box>
            <Text fontSize="lg" fontWeight="600" color="gray.800">
              {isManager
                ? "Configure Manager Agent"
                : initialData
                  ? "Edit Agent"
                  : "Add Agent"}
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
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel fontWeight="500" color="gray.700">
                  Agent Name
                </FormLabel>
                <Input
                  {...register("name", {
                    required: "Agent name is required",
                    validate: validateUniqueName,
                  })}
                  placeholder="Enter a unique agent name"
                  borderRadius="lg"
                  borderColor="gray.200"
                  _hover={{ borderColor: "blue.200" }}
                  _focus={{
                    borderColor: "blue.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                  }}
                  transition="all 0.2s"
                />
                <FormErrorMessage>
                  {errors.name && errors.name.message}
                </FormErrorMessage>
              </FormControl>

              <VariableSelector
                label="Role"
                value={watch("role") || ""}
                onChange={(value) => setValue("role", value)}
                placeholder={
                  isManager ? "Crew Manager" : "e.g., Research Specialist"
                }
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
                  <FormLabel mb="0" fontWeight="500" color="gray.700">
                    Allow Delegation
                  </FormLabel>
                  <Switch
                    {...register("allow_delegation")}
                    colorScheme="blue"
                    size="md"
                  />
                </FormControl>
              )}

              <Divider my={2} />

              <Box>
                <HStack justify="space-between" align="center" mb={3}>
                  <HStack spacing={2}>
                    <Box
                      p={2}
                      borderRadius="lg"
                      bg="blue.50"
                      color="blue.500"
                      transition="all 0.2s"
                      _hover={{ bg: "purple.100" }}
                    >
                      <FaTools size="14px" />
                    </Box>
                    <Text fontSize="md" fontWeight="600" color="gray.700">
                      Tools
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      ({selectedTools.length})
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<FaPlus size="12px" />}
                    onClick={() => setIsToolsListOpen(true)}
                    colorScheme="blue"
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-1px)",
                      shadow: "sm",
                    }}
                  >
                    Add Tool
                  </Button>
                </HStack>

                <VStack align="stretch" spacing={2}>
                  {selectedTools.map((tool) => (
                    <Box
                      key={tool}
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
                      <HStack justify="space-between" align="center">
                        <HStack spacing={2}>
                          <ToolsIcon tools_name={tool.replace(/ /g, "_")} />
                          <Text fontSize="sm" fontWeight="500" color="gray.700">
                            {tool}
                          </Text>
                        </HStack>
                        <IconButton
                          aria-label="Remove tool"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => removeTool(tool)}
                          transition="all 0.2s"
                          _hover={{
                            transform: "scale(1.1)",
                          }}
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
                bg="ui.main"
                color="white"
                fontWeight="500"
                borderRadius="lg"
                transition="all 0.2s"
                _hover={{
                  bg: "blue.500",
                  transform: "translateY(-1px)",
                  boxShadow: "md",
                }}
                _active={{
                  bg: "blue.600",
                  transform: "translateY(0)",
                }}
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
