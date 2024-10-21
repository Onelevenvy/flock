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
import { useMutation, useQueryClient } from "react-query";

// import SkillEditor, { skillPlaceholder } from "./SkillEditor"
import { type ApiError, type SkillCreate, ToolsService } from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface AddSkillProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddSkill = ({ isOpen, onClose }: AddSkillProps) => {
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
    formState: { errors, isSubmitting, isValid },
  } = useForm<SkillCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      description: "",
      // tool_definition: skillPlaceholder,
    },
  });

  const addSkill = async (data: SkillCreate) => {
    await ToolsService.createSkill({ requestBody: data });
  };

  const mutation = useMutation(addSkill, {
    onSuccess: () => {
      showToast("Success!", "Skill created successfully.", "success");
      reset();
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

  const onSubmit: SubmitHandler<SkillCreate> = (data) => {
    mutation.mutate(data);
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
          <ModalHeader>Add Skill</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="title"
                {...register("name", {
                  required: "Title is required.",
                  pattern: {
                    value: /^[a-zA-Z0-9_-]{1,64}$/,
                    message: "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
                  },
                })}
                placeholder="Title"
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
                  required: "Description is required.",
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

export default AddSkill;
