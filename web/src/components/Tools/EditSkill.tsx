import {
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
} from "@chakra-ui/react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";

// import SkillEditor, { skillPlaceholder } from "./SkillEditor"
import { useMutation, useQueryClient } from "react-query";

import {
  type ApiError,
  type SkillOut,
  type SkillUpdate,
  ToolsService,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface EditSkillProps {
  skill: SkillOut;
  isOpen: boolean;
  onClose: () => void;
}

const EditSkill = ({ skill, isOpen, onClose }: EditSkillProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { isSubmitting, errors, isDirty, isValid },
  } = useForm<SkillUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: skill,
  });

  const updateSkill = async (data: SkillUpdate) => {
    return await ToolsService.updateSkill({ id: skill.id, requestBody: data });
  };

  const mutation = useMutation(updateSkill, {
    onSuccess: (data) => {
      showToast("Success!", "Skill updated successfully.", "success");
      reset(data); // reset isDirty after updating
      onClose();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("skills");
    },
  });

  const onSubmit: SubmitHandler<SkillUpdate> = async (data) => {
    mutation.mutate(data);
  };

  const onCancel = () => {
    reset();
    onClose();
  };

  // const resetSkillDefinitionHandler = () => {
  //   setValue("tool_definition", skillPlaceholder)
  // }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "md", lg: "lg" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Edit Skill</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isInvalid={!!errors.name}>
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="name"
                {...register("name", {
                  required: "Name is required",
                  pattern: {
                    value: /^[a-zA-Z0-9_-]{1,64}$/,
                    message: "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
                  },
                })}
                type="text"
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>
            <FormControl isRequired isInvalid={!!errors.description} mt={4}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Input
                id="description"
                {...register("description", {
                  required: "Description is required",
                })}
                placeholder="Description"
                type="text"
              />
            </FormControl>
            <Controller
              rules={{ required: true }}
              control={control}
              name="tool_definition"
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormControl
                  isRequired
                  isInvalid={!!errors.tool_definition}
                  mt={4}
                >
                  <FormLabel htmlFor="tool_definition">
                    Skill Definition
                  </FormLabel>
                  {/* <SkillEditor
                    onChange={onChange}
                    onError={(message) =>
                      message
                        ? setError("tool_definition", { message })
                        : clearErrors("tool_definition")
                    }
                    value={value as object}
                  /> */}
                  <FormErrorMessage>{error?.message}</FormErrorMessage>
                  {/* <Button
                    size="sm"
                    leftIcon={<RxReset />}
                    mt={2}
                    onClick={resetSkillDefinitionHandler}
                  >
                    Reset Skill Definition
                  </Button> */}
                </FormControl>
              )}
            />
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

export default EditSkill;
