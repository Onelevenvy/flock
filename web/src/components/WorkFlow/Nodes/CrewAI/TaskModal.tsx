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

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskConfig) => void;
  initialData?: TaskConfig;
  agents: AgentConfig[];
  existingTaskNames: string[];
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  agents,
  existingTaskNames,
}) => {
  const { register, handleSubmit, formState: { errors }, watch } = useForm<TaskConfig>({
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
            <VStack spacing={4}>
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

              <FormControl isRequired>
                <FormLabel fontWeight="500">Description</FormLabel>
                <Textarea
                  {...register("description")}
                  placeholder="Task description"
                  borderColor="gray.200"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{ borderColor: "blue.500", boxShadow: "none" }}
                  minH="100px"
                  resize="vertical"
                />
              </FormControl>

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

              <FormControl>
                <FormLabel fontWeight="500">Expected Output</FormLabel>
                <Textarea
                  {...register("expected_output")}
                  placeholder="Expected output format or description"
                  borderColor="gray.200"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{ borderColor: "blue.500", boxShadow: "none" }}
                  minH="100px"
                  resize="vertical"
                />
              </FormControl>

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