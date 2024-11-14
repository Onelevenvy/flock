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
  Select,
  Button,
  FormErrorMessage,
  HStack,
  Text,
  Box,
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";
import { FaListAlt } from "react-icons/fa";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
    if (!value) return String(t("knowledge.upload.error.required"));
    if (!initialData && existingTaskNames.includes(value)) {
      return String(t("workflow.nodes.crewai.taskModal.uniqueNameError"));
    }
    if (initialData && existingTaskNames.filter(name => name !== initialData.name).includes(value)) {
      return String(t("workflow.nodes.crewai.taskModal.uniqueNameError"));
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
              <FaListAlt size="20px" />
            </Box>
            <Text fontSize="lg" fontWeight="600" color="gray.800">
              {initialData 
                ? t("workflow.nodes.crewai.taskModal.editTitle")
                : t("workflow.nodes.crewai.taskModal.addTitle")
              }
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
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel fontWeight="500" color="gray.700">
                  {t("workflow.nodes.crewai.taskModal.name")}
                </FormLabel>
                <Input
                  {...register("name", {
                    required: String(t("knowledge.upload.error.required")),
                    validate: validateUniqueName
                  })}
                  placeholder={String(t("workflow.nodes.crewai.taskModal.namePlaceholder"))}
                  borderRadius="lg"
                  borderColor="gray.200"
                  _hover={{ borderColor: "green.200" }}
                  _focus={{
                    borderColor: "green.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-green-500)"
                  }}
                  transition="all 0.2s"
                />
                <FormErrorMessage>
                  {errors.name && errors.name.message}
                </FormErrorMessage>
              </FormControl>

              <VariableSelector
                label={t("workflow.nodes.crewai.taskModal.description")}
                value={watch("description") || ""}
                onChange={(value) => setValue("description", value)}
                placeholder={String(t("workflow.nodes.crewai.taskModal.descriptionPlaceholder"))}
                showVariables={descriptionVariableHook.showVariables}
                setShowVariables={descriptionVariableHook.setShowVariables}
                inputRef={descriptionVariableHook.inputRef}
                handleKeyDown={descriptionVariableHook.handleKeyDown}
                insertVariable={descriptionVariableHook.insertVariable}
                availableVariables={availableVariables}
                minHeight="100px"
              />

              <FormControl isRequired>
                <FormLabel fontWeight="500" color="gray.700">
                  {t("workflow.nodes.crewai.taskModal.assignAgent")}
                </FormLabel>
                <Select 
                  {...register("agent_id")} 
                  placeholder={String(t("workflow.nodes.crewai.taskModal.selectAgent"))}
                  borderRadius="lg"
                  borderColor="gray.200"
                  _hover={{ borderColor: "green.200" }}
                  _focus={{
                    borderColor: "green.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-green-500)"
                  }}
                  transition="all 0.2s"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <VariableSelector
                label={t("workflow.nodes.crewai.taskModal.expectedOutput")}
                value={watch("expected_output") || ""}
                onChange={(value) => setValue("expected_output", value)}
                placeholder={String(t("workflow.nodes.crewai.taskModal.expectedOutputPlaceholder"))}
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
                colorScheme="green"
                size="md"
                w="100%"
                borderRadius="lg"
                bg="ui.main"
                color="white"
                fontWeight="500"
                transition="all 0.2s"
                _hover={{
                  bg: "green.600",
                  transform: "translateY(-1px)",
                  boxShadow: "md",
                }}
                _active={{
                  bg: "green.700",
                  transform: "translateY(0)",
                }}
              >
                {initialData ? t("workflow.common.edit") : t("workflow.common.add")}
              </Button>
            </VStack>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default TaskModal;