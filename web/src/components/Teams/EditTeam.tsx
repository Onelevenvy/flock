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
  VStack,
  useColorModeValue,
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

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

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
      reset(data);
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
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size={{ base: "sm", md: "md" }}
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
          {t("team.addteam.editteam")}
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
              <Text 
                fontSize="sm"
                fontWeight="600"
                color="gray.700"
                mb={3}
              >
                {t("team.addteam.nameandicon")}
              </Text>
              
              <Box display="flex" alignItems="center" gap={4}>
                <FormControl w="auto">
                  <Controller
                    name="icon"
                    control={control}
                    defaultValue="0"
                    render={({ field: { onChange, value } }) => (
                      <IconPicker
                        onSelect={onChange}
                        selectedIcon={value!}
                      />
                    )}
                  />
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.name} flex={1}>
                  <Input
                    {...register("name", {
                      required: "Title is required.",
                      pattern: {
                        value: /^[a-zA-Z0-9_-]{1,64}$/,
                        message: "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
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
              <FormLabel 
                htmlFor="description"
                fontSize="sm"
                fontWeight="600"
                color="gray.700"
              >
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

        <ModalFooter 
          borderTop="1px solid"
          borderColor={borderColor}
          gap={3}
        >
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting || mutation.isLoading}
            isDisabled={!isDirty || !isValid}
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
            onClick={onCancel}
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

export default EditTeam;
