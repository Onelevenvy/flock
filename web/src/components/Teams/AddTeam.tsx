// AddTeam.tsx
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { GiTeamIdea } from "react-icons/gi";
import { RiChatVoiceLine, RiTeamFill } from "react-icons/ri";
import { SiKashflow, SiVisualstudiocode } from "react-icons/si";
import { TbDatabaseSearch } from "react-icons/tb";
import { useMutation, useQueryClient } from "react-query";

import IconPicker from "@/components/Icons/TqxIcon";

import { type ApiError, type TeamCreate, TeamsService } from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface AddTeamProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WorkflowCardProps {
  workflow: string;
  selectedWorkflow: string;
  handleWorkflowClick: (workflow: string) => void;
}

interface CardIconInfo {
  colorScheme: string;
  backgroundColor: string;
  icon: JSX.Element;
  title: string;
  descripthion: string;
}

type CardIcons = {
  [key: string]: CardIconInfo;
};

const AddTeam = ({ isOpen, onClose }: AddTeamProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("chatbot");

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");
  const cardBgColor = useColorModeValue("white", "gray.700");
  const cardHoverBgColor = useColorModeValue("gray.50", "gray.600");

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<TeamCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      description: "",
      icon: "0",
    },
  });

  const addTeam = async (data: TeamCreate) => {
    await TeamsService.createTeam({ requestBody: data });
  };

  const mutation = useMutation(addTeam, {
    onSuccess: () => {
      showToast("Success!", "Team created successfully.", "success");
      reset();
      onClose();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("teams");
    },
  });

  const onSubmit: SubmitHandler<TeamCreate> = (data) => {
    mutation.mutate({ ...data, workflow: selectedWorkflow });
  };

  const handleWorkflowClick = (workflow: string) => {
    setSelectedWorkflow(workflow);
  };

  // 任务类型列表
  const taskTypes = [
    "chatbot",
    "ragbot",
    "hierarchical",
    "sequential",
    "workflow",
    "codeassistant",
  ];

  const cardIcons: CardIcons = {
    chatbot: {
      colorScheme: "blue",
      backgroundColor: "#36abff",
      icon: <RiTeamFill size="24" />,
      title: t("team.teamcard.chatbot.title"),
      descripthion: t("team.teamcard.chatbot.description"),
    },
    ragbot: {
      colorScheme: "green",
      backgroundColor: "#4caf50",
      icon: <TbDatabaseSearch size="24" />,
      title: t("team.teamcard.ragbot.title"),
      descripthion: t("team.teamcard.ragbot.description"),
    },
    workflow: {
      colorScheme: "teal",
      backgroundColor: "teal",
      icon: <SiKashflow size="24" />,
      title: t("team.teamcard.workflow.title"),
      descripthion: t("team.teamcard.workflow.description"),
    },
    hierarchical: {
      colorScheme: "yellow",
      backgroundColor: "#ffc107",
      icon: <RiChatVoiceLine size="24" />,
      title: t("team.teamcard.hagent.title"),
      descripthion: t("team.teamcard.hagent.description"),
    },
    sequential: {
      colorScheme: "red",
      backgroundColor: "#ff5722",
      icon: <GiTeamIdea size="24" />,
      title: t("team.teamcard.sagent.title"),
      descripthion: t("team.teamcard.sagent.description"),
    },
    codeassistant: {
      colorScheme: "yellow",
      backgroundColor: "#ad7f9a",
      icon: <SiVisualstudiocode size="24" />,
      title: "Code assistant",
      descripthion: "To be added",
    },
  };

  // WorkflowCard 组件
  const WorkflowCard: React.FC<WorkflowCardProps> = ({
    workflow,
    selectedWorkflow,
    handleWorkflowClick,
  }) => {
    const isSelected = selectedWorkflow === workflow;
    const info = cardIcons[workflow];

    return (
      <Box
        bg={cardBgColor}
        p={4}
        onClick={() => handleWorkflowClick(workflow)}
        cursor="pointer"
        borderRadius="xl"
        border="2px solid"
        borderColor={isSelected ? "ui.main" : borderColor}
        transition="all 0.2s"
        _hover={{
          bg: cardHoverBgColor,
          transform: "translateY(-2px)",
          boxShadow: "md",
        }}
        _active={{
          transform: "translateY(0)",
        }}
      >
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton
            aria-label={info.title}
            icon={info.icon}
            bg={info.backgroundColor}
            color="white"
            size="md"
            borderRadius="lg"
            _hover={{ bg: info.backgroundColor }}
          />
          <Text ml={3} fontSize="md" fontWeight="600" color="gray.800">
            {info.title}
          </Text>
        </Box>
        <Text fontSize="sm" color="gray.500" noOfLines={2} lineHeight="tall">
          {info.descripthion}
        </Text>
      </Box>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        bg={bgColor}
        borderRadius="xl"
        boxShadow="xl"
        border="1px solid"
        borderColor={borderColor}
        as="form"
        onSubmit={handleSubmit(onSubmit)}
      >
        <ModalHeader
          borderBottom="1px solid"
          borderColor={borderColor}
          py={4}
          fontSize="lg"
          fontWeight="600"
        >
          {t("team.addteam.createteam")}
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

        <ModalBody py={6}>
          <VStack spacing={6} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
                {t("team.addteam.apptype")}
              </Text>
              <SimpleGrid columns={2} spacing={4}>
                {taskTypes.map((workflow) => (
                  <WorkflowCard
                    key={workflow}
                    workflow={workflow}
                    selectedWorkflow={selectedWorkflow}
                    handleWorkflowClick={handleWorkflowClick}
                  />
                ))}
              </SimpleGrid>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="600" color="gray.700" mb={3}>
                {t("team.addteam.nameandicon")}
              </Text>

              <Box display="flex" alignItems="center" gap={4}>
                <FormControl w="auto">
                  <Controller
                    name="icon"
                    control={control}
                    defaultValue="0"
                    render={({ field: { onChange, value } }) => (
                      <IconPicker onSelect={onChange} selectedIcon={value!} />
                    )}
                  />
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.name} flex={1}>
                  <Input
                    {...register("name", {
                      required: "Title is required.",
                      pattern: {
                        value: /^[a-zA-Z0-9_-]{1,64}$/,
                        message:
                          "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
                      },
                    })}
                    placeholder={t("team.addteam.placeholderapp") as string}
                    bg={inputBgColor}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="lg"
                    fontSize="sm"
                    w="full"
                    minW="300px"
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "gray.300",
                    }}
                    _focus={{
                      borderColor: "ui.main",
                      boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                    }}
                  />
                  {errors.name && (
                    <FormErrorMessage>{errors.name.message}</FormErrorMessage>
                  )}
                </FormControl>
              </Box>
            </Box>

            <FormControl>
              <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                {t("team.addteam.description")}
              </FormLabel>
              <Textarea
                {...register("description")}
                placeholder={t("team.addteam.placeholderdescription") as string}
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                resize="vertical"
                minH="100px"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            isDisabled={!isValid}
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-1px)",
              boxShadow: "md",
            }}
            _active={{
              transform: "translateY(0)",
            }}
          >
            Save
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddTeam;
