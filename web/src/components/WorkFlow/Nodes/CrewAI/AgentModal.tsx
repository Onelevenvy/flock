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
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";

import { AgentConfig } from "../../types";
import { DEFAULT_MANAGER } from './constants';
import { v4 } from "uuid";

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
  const { register, handleSubmit, formState: { errors } } = useForm<AgentConfig>({
    defaultValues: initialData || {
      id: v4(),
      name: "",
      role: isManager ? DEFAULT_MANAGER.role : "",
      goal: isManager ? DEFAULT_MANAGER.goal : "",
      backstory: isManager ? DEFAULT_MANAGER.backstory : "",
      use_search: false,
      use_scraper: false,
      allow_delegation: isManager,
    },
  });

  const validateUniqueName = (value: string) => {
    if (!value) return "Agent name is required";
    if (!initialData && existingAgentNames.includes(value)) {
      return "Agent name must be unique";
    }
    if (initialData && existingAgentNames.filter(name => name !== initialData.name).includes(value)) {
      return "Agent name must be unique";
    }
    return true;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isManager ? "Configure Manager Agent" : (initialData ? "Edit Agent" : "Add Agent")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel>Agent Name</FormLabel>
                <Input 
                  {...register("name", {
                    required: "Agent name is required",
                    validate: validateUniqueName
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
                  placeholder={isManager ? "Crew Manager" : "e.g., Research Specialist"}
                  isReadOnly={isManager}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Goal</FormLabel>
                <Input {...register("goal")} placeholder="Agent's primary objective" />
              </FormControl>

              <FormControl>
                <FormLabel>Backstory</FormLabel>
                <Textarea {...register("backstory")} placeholder="Agent's background and expertise" />
              </FormControl>

              {!isManager && (
                <Box w="100%">
                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0">Use Search</FormLabel>
                    <Switch {...register("use_search")} />
                  </FormControl>

                  <FormControl display="flex" alignItems="center" mt={2}>
                    <FormLabel mb="0">Use Web Scraper</FormLabel>
                    <Switch {...register("use_scraper")} />
                  </FormControl>

                  <FormControl display="flex" alignItems="center" mt={2}>
                    <FormLabel mb="0">Allow Delegation</FormLabel>
                    <Switch {...register("allow_delegation")} />
                  </FormControl>
                </Box>
              )}

              <Button type="submit" colorScheme="blue" w="100%">
                {isManager ? "Save Manager Configuration" : (initialData ? "Update" : "Add")} Agent
              </Button>
            </VStack>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AgentModal;