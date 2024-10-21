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

const AddTeam = ({ isOpen, onClose }: AddTeamProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
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

  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("chatbot");

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

  const cardIcons: Record<
    string,
    {
      colorScheme: string;
      backgroundColor: string;
      icon: React.ReactElement;
      title: string;
      descripthion: string;
    }
  > = {
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
      // title: t("team.teamcard.sagent.title"),
      // descripthion: t("team.teamcard.sagent.description"),
      title: "Code assistant",
      descripthion: "To be added",
    },
  };

  // WorkflowButton 组件
  const WorkflowCard: React.FC<{
    workflow: string;
    selectedWorkflow: string;
    handleWorkflowClick: (workflow: string) => void;
  }> = ({ workflow, selectedWorkflow, handleWorkflowClick }) => {
    return (
      <Box
        bg={selectedWorkflow === workflow ? "gray.100" : "white.200"}
        height="125px"
        onClick={() => handleWorkflowClick(workflow)}
        cursor="pointer"
        borderRadius={"md"}
        border={
          selectedWorkflow === workflow
            ? "2px solid #9ebbfe"
            : "2px solid #ecedf2"
        }
      >
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          mt={3}
          ml={3}
        >
          <IconButton
            colorScheme={cardIcons[workflow].colorScheme} // 根据任务类型获取对应的 colorScheme
            aria-label="Search database"
            icon={cardIcons[workflow].icon} // 根据任务类型获取对应的图标
            backgroundColor={cardIcons[workflow].backgroundColor} // 根据任务类型获取对应的 backgroundColor
            // size="sm"
          />

          <Text textAlign="left" ml={3} fontSize={"lg"}>
            {cardIcons[workflow].title}
          </Text>
        </Box>
        <Text
          textAlign="left"
          ml={3}
          pr="3"
          pb="2"
          fontSize={"sm"}
          color={"gray.500"}
        >
          {cardIcons[workflow].descripthion}
        </Text>
      </Box>
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>{t("team.addteam.createteam")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text whiteSpace="nowrap" fontWeight={"bold"} pb="4">
              {t("team.addteam.apptype")}
            </Text>
            <SimpleGrid columns={2} spacing={6} pb={4}>
              {taskTypes.map((workflow) => (
                <WorkflowCard
                  key={workflow}
                  workflow={workflow}
                  selectedWorkflow={selectedWorkflow}
                  handleWorkflowClick={handleWorkflowClick}
                />
              ))}
            </SimpleGrid>
            <Box alignItems={"left"}>
              <Text whiteSpace="nowrap" pb={2} fontWeight={"bold"}>
                {t("team.addteam.nameandicon")}
              </Text>
              <Box
                display="flex"
                flexDirection="row"
                alignItems="center"
                alignContent={"center"}
              >
                <Box display="flex" alignItems="center" alignContent={"center"}>
                  <FormControl>
                    <Controller
                      name="icon"
                      control={control}
                      defaultValue="0" // 默认值
                      render={({ field: { onChange, value } }) => (
                        <Box
                          display="flex"
                          alignItems="center"
                          alignContent={"center"}
                        >
                          <IconPicker
                            onSelect={onChange}
                            selectedIcon={value!}
                          />
                        </Box>
                      )}
                    />
                  </FormControl>
                </Box>

                <FormControl isRequired isInvalid={!!errors.name} ml="2">
                  <Input
                    id="title"
                    {...register("name", {
                      required: "Title is required.",
                      pattern: {
                        value: /^[a-zA-Z0-9_-]{1,64}$/,
                        message:
                          "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
                      },
                    })}
                    placeholder={t("team.addteam.placeholderapp") as string}
                    type="text"
                  />
                  {errors.name && (
                    <FormErrorMessage>{errors.name.message}</FormErrorMessage>
                  )}
                </FormControl>
              </Box>
            </Box>
            <FormControl mt={4}>
              <FormLabel htmlFor="description" fontWeight={"bold"}>
                {t("team.addteam.description")}
              </FormLabel>
              <Textarea
                id="description"
                resize="none"
                {...register("description")}
                placeholder={t("team.addteam.placeholderdescription") as string}
              />
            </FormControl>
          </ModalBody>

          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              isDisabled={!isValid}
            >
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default AddTeam;
