import {
  Avatar,
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import {
  type ApiError,
  type UserOut,
  type UserUpdateMe,
  UsersService,
} from "../../../client";
import useAuth from "../../../hooks/useAuth";
import useCustomToast from "../../../hooks/useCustomToast";
import { emailPattern } from "../../../utils";

const UserInfoPage = () => {
  const queryClient = useQueryClient();
  const color = useColorModeValue("inherit", "ui.white");
  const showToast = useCustomToast();
  const [editMode, setEditMode] = useState(false);
  const { user: currentUser } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<UserOut>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name,
      email: currentUser?.email,
    },
  });

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const updateInfo = async (data: UserUpdateMe) => {
    await UsersService.updateUserMe({ requestBody: data });
  };

  const mutation = useMutation(updateInfo, {
    onSuccess: () => {
      showToast("Success!", "User updated successfully.", "success");
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("users");
      queryClient.invalidateQueries("currentUser");
    },
  });

  const onSubmit: SubmitHandler<UserUpdateMe> = async (data) => {
    mutation.mutate(data);
  };

  const onCancel = () => {
    reset();
    toggleEditMode();
  };

  return (
    <>
      <Container maxW="full" as="form" onSubmit={handleSubmit(onSubmit)}>
        <FormLabel color={color} htmlFor="name">
          Avatar
        </FormLabel>
        <Box w="full">
          <FormControl>
            <Avatar
              size="md"
              name={currentUser?.full_name!}
              src=""
              cursor="pointer"
            />
            <FormLabel color={color} htmlFor="name" mt="8">
              Name
            </FormLabel>
            {editMode ? (
              <Input
                id="name"
                {...register("full_name", { maxLength: 30 })}
                type="text"
                size="md"
              />
            ) : (
              <Text
                size="md"
                py={2}
                px="4"
                color={!currentUser?.full_name ? "gray.400" : "inherit"}
                bg={"#f2f4f7"}
              >
                {currentUser?.full_name || "N/A"}
              </Text>
            )}
          </FormControl>
          <FormControl mt={8} isInvalid={!!errors.email}>
            <FormLabel color={color} htmlFor="email">
              Email
            </FormLabel>
            {editMode ? (
              <Input
                id="email"
                {...register("email", {
                  required: "Email is required",
                  pattern: emailPattern,
                })}
                type="email"
                size="md"
              />
            ) : (
              <Text size="md" py={2} px="4" bg={"#f2f4f7"}>
                {currentUser?.email}
              </Text>
            )}
            {errors.email && (
              <FormErrorMessage>{errors.email.message}</FormErrorMessage>
            )}
          </FormControl>
          <Flex mt={8} gap={3} justifyContent={"right"}>
            <Button
              variant="primary"
              onClick={toggleEditMode}
              type={editMode ? "button" : "submit"}
              isLoading={editMode ? isSubmitting : false}
              isDisabled={editMode ? !isDirty || !getValues("email") : false}
            >
              {editMode ? "Save" : "Edit Account"}
            </Button>
            {editMode && (
              <Button
                onClick={onCancel}
                isDisabled={isSubmitting}
                variant="primary"
              >
                Cancel
              </Button>
            )}
          </Flex>
        </Box>
      </Container>
    </>
  );
};

export default UserInfoPage;
