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
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";

import { AgentConfig, TaskConfig } from "../../types";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskConfig) => void;
  initialData?: TaskConfig;
  agents: AgentConfig[];
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  agents,
}) => {
  const { register, handleSubmit } = useForm<TaskConfig>({
    defaultValues: initialData || {
      description: "",
      agent_id: "",
      expected_output: "",
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initialData ? "Edit Task" : "Add Task"}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Description</FormLabel>
                <Textarea
                  {...register("description")}
                  placeholder="Task description"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Assign Agent</FormLabel>
                <Select {...register("agent_id")} placeholder="Select agent">
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.role}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Expected Output</FormLabel>
                <Textarea
                  {...register("expected_output")}
                  placeholder="Expected output format or description"
                />
              </FormControl>

              <Button type="submit" colorScheme="blue" w="100%">
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