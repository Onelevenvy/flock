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
  VStack,
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
  const showToast = useCustomToast();
  const [editMode, setEditMode] = useState(false);
  const { user: currentUser } = useAuth();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");
  const labelColor = useColorModeValue("gray.700", "gray.300");
  const textBgColor = useColorModeValue("gray.50", "gray.700");

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
    <Container maxW="full">
      <Box
        bg={bgColor}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        p={6}
        transition="all 0.2s"
        boxShadow="sm"
        _hover={{
          boxShadow: "md",
          borderColor: "gray.200",
        }}
        as="form"
        onSubmit={handleSubmit(onSubmit)}
      >
        <VStack spacing={6} align="stretch">
          <FormControl>
            <FormLabel 
              color={labelColor}
              fontSize="sm"
              fontWeight="600"
              mb={3}
            >
              Avatar
            </FormLabel>
            <Avatar
              size="lg"
              name={currentUser?.full_name!}
              src=""
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                transform: "scale(1.05)",
                boxShadow: "md",
              }}
            />
          </FormControl>

          <FormControl>
            <FormLabel 
              color={labelColor}
              fontSize="sm"
              fontWeight="600"
              mb={3}
            >
              Name
            </FormLabel>
            {editMode ? (
              <Input
                {...register("full_name", { maxLength: 30 })}
                type="text"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            ) : (
              <Box
                py={2}
                px={4}
                bg={textBgColor}
                borderRadius="lg"
                transition="all 0.2s"
              >
                <Text
                  color={!currentUser?.full_name ? "gray.400" : "gray.700"}
                  fontSize="sm"
                >
                  {currentUser?.full_name || "N/A"}
                </Text>
              </Box>
            )}
          </FormControl>

          <FormControl isInvalid={!!errors.email}>
            <FormLabel 
              color={labelColor}
              fontSize="sm"
              fontWeight="600"
              mb={3}
            >
              Email
            </FormLabel>
            {editMode ? (
              <Input
                {...register("email", {
                  required: "Email is required",
                  pattern: emailPattern,
                })}
                type="email"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            ) : (
              <Box
                py={2}
                px={4}
                bg={textBgColor}
                borderRadius="lg"
                transition="all 0.2s"
              >
                <Text color="gray.700" fontSize="sm">
                  {currentUser?.email}
                </Text>
              </Box>
            )}
            {errors.email && (
              <FormErrorMessage>{errors.email.message}</FormErrorMessage>
            )}
          </FormControl>

          <Flex mt={4} gap={3} justify="flex-end">
            <Button
              variant="primary"
              onClick={editMode ? handleSubmit(onSubmit) : toggleEditMode}
              type={editMode ? "submit" : "button"}
              isLoading={editMode ? isSubmitting : false}
              isDisabled={editMode ? !isDirty || !getValues("email") : false}
              transition="all 0.2s"
              _hover={{
                transform: "translateY(-1px)",
                boxShadow: "md",
              }}
              _active={{
                transform: "translateY(0)",
              }}
            >
              {editMode ? "Save" : "Edit Account"}
            </Button>
            {editMode && (
              <Button
                onClick={onCancel}
                isDisabled={isSubmitting}
                variant="ghost"
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                }}
              >
                Cancel
              </Button>
            )}
          </Flex>
        </VStack>
      </Box>
    </Container>
  );
};

export default UserInfoPage;
