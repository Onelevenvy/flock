import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormErrorMessage,
  Input,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation } from "react-query";

import {
  type ApiError,
  type UpdatePassword,
  UsersService,
} from "../../../client";
import useCustomToast from "../../../hooks/useCustomToast";

interface UpdatePasswordForm extends UpdatePassword {
  confirm_password: string;
}

const ChangePasswordPage = () => {
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    mode: "onBlur",
    criteriaMode: "all",
  });

  const UpdatePassword = async (data: UpdatePassword) => {
    await UsersService.updatePasswordMe({ requestBody: data });
  };

  const mutation = useMutation(UpdatePassword, {
    onSuccess: () => {
      showToast("Success!", "Password updated.", "success");
      reset();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
  });

  const onSubmit: SubmitHandler<UpdatePasswordForm> = async (data) => {
    mutation.mutate(data);
  };

  const onCancel = () => {
    reset();
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
          <Text fontSize="lg" fontWeight="600" color="gray.800">
            Change Password
          </Text>

          <FormControl isRequired isInvalid={!!errors.current_password}>
            <Flex align="center" gap={4}>
              <Text 
                w="140px" 
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
                flexShrink={0}
              >
                Current password:
              </Text>
              <Input
                {...register("current_password")}
                type="password"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                flex={1}
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            </Flex>
            {errors.current_password && (
              <FormErrorMessage>{errors.current_password.message}</FormErrorMessage>
            )}
          </FormControl>

          <FormControl isRequired isInvalid={!!errors.new_password}>
            <Flex align="center" gap={4}>
              <Text 
                w="140px" 
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
                flexShrink={0}
              >
                New Password:
              </Text>
              <Input
                {...register("new_password", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
                type="password"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                flex={1}
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            </Flex>
            {errors.new_password && (
              <FormErrorMessage>{errors.new_password.message}</FormErrorMessage>
            )}
          </FormControl>

          <FormControl isRequired isInvalid={!!errors.confirm_password}>
            <Flex align="center" gap={4}>
              <Text 
                w="140px" 
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
                flexShrink={0}
              >
                Confirm Password:
              </Text>
              <Input
                {...register("confirm_password", {
                  required: "Please confirm your password",
                  validate: (value) =>
                    value === getValues().new_password ||
                    "The passwords do not match",
                })}
                type="password"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                flex={1}
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            </Flex>
            {errors.confirm_password && (
              <FormErrorMessage>{errors.confirm_password.message}</FormErrorMessage>
            )}
          </FormControl>

          <Flex mt={4} gap={3} justify="flex-end">
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
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
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
          </Flex>
        </VStack>
      </Box>
    </Container>
  );
};

export default ChangePasswordPage;
