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
  Select,
  Button,
  FormErrorMessage,
  HStack,
  Text,
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";
import { FaListAlt } from "react-icons/fa";

import { AgentConfig, TaskConfig } from "../../types";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import VariableSelector from "../../Common/VariableSelector";
import { VariableReference } from "../../FlowVis/variableSystem";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskConfig) => void;
  initialData?: TaskConfig;
  agents: AgentConfig[];
  existingTaskNames: string[];
  availableVariables: VariableReference[];
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  agents,
  existingTaskNames,
  availableVariables,
}) => {
  const { 
    register, 
    handleSubmit, 
    formState: { errors }, 
    watch,
    setValue,
  } = useForm<TaskConfig>({
    defaultValues: initialData || {
      name: "",
      description: "",
      agent_id: "",
      expected_output: "",
    },
  });

  const validateUniqueName = (value: string) => {
    if (!value) return "Task name is required";
    if (!initialData && existingTaskNames.includes(value)) {
      return "Task name must be unique";
    }
    if (initialData && existingTaskNames.filter(name => name !== initialData.name).includes(value)) {
      return "Task name must be unique";
    }
    return true;
  };

  const descriptionVariableHook = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => setValue("description", value),
    availableVariables,
  });

  const expectedOutputVariableHook = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => setValue("expected_output", value),
    availableVariables,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <FaListAlt size="20px" color="#4A5568" />
            <Text>{initialData ? "Edit Task" : "Add Task"}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel fontWeight="500">Task Name</FormLabel>
                <Input
                  {...register("name", {
                    required: "Task name is required",
                    validate: validateUniqueName
                  })}
                  placeholder="Enter a unique task name"
                  borderColor="gray.200"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{ borderColor: "blue.500", boxShadow: "none" }}
                />
                <FormErrorMessage>
                  {errors.name && errors.name.message}
                </FormErrorMessage>
              </FormControl>

              <VariableSelector
                label="Description"
                value={watch("description") || ""}
                onChange={(value) => setValue("description", value)}
                placeholder="Task description"
                showVariables={descriptionVariableHook.showVariables}
                setShowVariables={descriptionVariableHook.setShowVariables}
                inputRef={descriptionVariableHook.inputRef}
                handleKeyDown={descriptionVariableHook.handleKeyDown}
                insertVariable={descriptionVariableHook.insertVariable}
                availableVariables={availableVariables}
                minHeight="100px"
              />

              <FormControl isRequired>
                <FormLabel fontWeight="500">Assign Agent</FormLabel>
                <Select 
                  {...register("agent_id")} 
                  placeholder="Select agent"
                  borderColor="gray.200"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{ borderColor: "blue.500", boxShadow: "none" }}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <VariableSelector
                label="Expected Output"
                value={watch("expected_output") || ""}
                onChange={(value) => setValue("expected_output", value)}
                placeholder="Expected output format or description"
                showVariables={expectedOutputVariableHook.showVariables}
                setShowVariables={expectedOutputVariableHook.setShowVariables}
                inputRef={expectedOutputVariableHook.inputRef}
                handleKeyDown={expectedOutputVariableHook.handleKeyDown}
                insertVariable={expectedOutputVariableHook.insertVariable}
                availableVariables={availableVariables}
                minHeight="100px"
              />

              <Button 
                type="submit" 
                colorScheme="blue" 
                w="100%"
                size="md"
              >
                {initialData ? "Update" : "Add"} Task
              </Button>
            </VStack>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default TaskModal;