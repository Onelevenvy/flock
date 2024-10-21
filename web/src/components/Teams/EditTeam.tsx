import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "react-query";

import IconPicker from "@/components/Icons/TqxIcon";

import {
  type ApiError,
  type TeamOut,
  type TeamUpdate,
  TeamsService,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface EditTeamProps {
  team: TeamOut;
  isOpen: boolean;
  onClose: () => void;
}

const EditTeam = ({ team, isOpen, onClose }: EditTeamProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting, errors, isDirty, isValid },
  } = useForm<TeamUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: team,
  });

  const updateTeam = async (data: TeamUpdate) => {
    return await TeamsService.updateTeam({ id: team.id, requestBody: data });
  };

  const mutation = useMutation(updateTeam, {
    onSuccess: (data) => {
      showToast("Success!", "Team updated successfully.", "success");
      reset(data); // reset isDirty after updating
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

  const onSubmit: SubmitHandler<TeamUpdate> = async (data) => {
    mutation.mutate(data);
  };

  const onCancel = () => {
    reset();
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>{t("team.addteam.editteam")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
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
                {...register("description")}
                placeholder={t("team.addteam.placeholderdescription") as string}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting || mutation.isLoading}
              isDisabled={!isDirty || !isValid}
            >
              Save
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default EditTeam;
