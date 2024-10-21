import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormErrorMessage,
  Heading,
  Input,
  Text,
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
  const color = useColorModeValue("inherit", "ui.white");
  const showToast = useCustomToast();
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
    <>
      <Container maxW="full" as="form" onSubmit={handleSubmit(onSubmit)}>
        <Heading size="sm" py={4}>
          Change Password
        </Heading>

        <Box w="full" mt="4">
          <FormControl isRequired isInvalid={!!errors.current_password}>
            <Flex align="center">
              <Text whiteSpace="nowrap" flexShrink={0} mr={4} w={"140px"}>
                Current password:
              </Text>
              <Input
                id="current_password"
                {...register("current_password")}
                type="password"
                flex="1"
              />
            </Flex>
            {errors.current_password && (
              <FormErrorMessage>
                {errors.current_password.message}
              </FormErrorMessage>
            )}
          </FormControl>

          <FormControl mt={4} isRequired isInvalid={!!errors.new_password}>
            <Flex align="center">
              <Text whiteSpace="nowrap" flexShrink={0} mr={4} w={"140px"}>
                New Password:
              </Text>
              <Input
                id="password"
                {...register("new_password", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
                type="password"
                flex="1"
              />
            </Flex>
            {errors.new_password && (
              <FormErrorMessage>{errors.new_password.message}</FormErrorMessage>
            )}
          </FormControl>

          <FormControl mt={4} isRequired isInvalid={!!errors.confirm_password}>
            <Flex align="center">
              <Text whiteSpace="nowrap" flexShrink={0} mr={4} w={"140px"}>
                Confirm Password:
              </Text>
              <Input
                id="confirm_password"
                {...register("confirm_password", {
                  required: "Please confirm your password",
                  validate: (value) =>
                    value === getValues().new_password ||
                    "The passwords do not match",
                })}
                type="password"
                flex="1"
              />
            </Flex>
            {errors.confirm_password && (
              <FormErrorMessage>
                {errors.confirm_password.message}
              </FormErrorMessage>
            )}
          </FormControl>
          <Flex mt={8} gap={3} justifyContent={"right"}>
            <Button mt={4} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              mt={4}
              type="submit"
              isLoading={isSubmitting}
            >
              Save
            </Button>
          </Flex>
        </Box>
      </Container>
    </>
  );
};

export default ChangePasswordPage;
