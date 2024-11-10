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
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { AgentConfig } from "../../types";

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agent: AgentConfig) => void;
  initialData?: AgentConfig;
}

const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { register, handleSubmit, control, setValue } = useForm<AgentConfig>({
    defaultValues: initialData || {
      id: crypto.randomUUID(),
      role: "",
      goal: "",
      backstory: "",
      use_search: false,
      use_scraper: false,
      allow_delegation: false,
    },
  });

  const { data: models } = useModelQuery();

  const onModelSelect = (modelName: string) => {
    const selectedModel = models?.data.find(
      (model) => model.ai_model_name === modelName
    );
    if (selectedModel) {
      setValue("model", modelName);
      setValue("base_url", selectedModel.provider.base_url || "");
      setValue("api_key", selectedModel.provider.api_key || "");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initialData ? "Edit Agent" : "Add Agent"}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Role</FormLabel>
                <Input {...register("role")} placeholder="e.g., Research Specialist" />
              </FormControl>

              <FormControl>
                <FormLabel>Goal</FormLabel>
                <Input {...register("goal")} placeholder="Agent's primary objective" />
              </FormControl>

              <FormControl>
                <FormLabel>Backstory</FormLabel>
                <Textarea {...register("backstory")} placeholder="Agent's background and expertise" />
              </FormControl>

              <FormControl>
                <FormLabel>Model</FormLabel>
                <ModelSelect
                  models={models}
                  control={control}
                  name="model"
                  onModelSelect={onModelSelect}
                />
              </FormControl>

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

              <Button type="submit" colorScheme="blue" w="100%">
                {initialData ? "Update" : "Add"} Agent
              </Button>
            </VStack>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AgentModal; 