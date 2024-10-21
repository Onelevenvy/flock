"use client";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  Button,
  Center,
  Container,
  FormControl,
  FormErrorMessage,
  Icon,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  useBoolean,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import React from "react";
import { type SubmitHandler, useForm } from "react-hook-form";

import type { ApiError } from "@/client";
import type { Body_login_login_access_token as AccessToken } from "@/client/models/Body_login_login_access_token";
import useAuth from "@/hooks/useAuth";
import { emailPattern } from "@/utils";


function Login() {
  const [show, setShow] = useBoolean();
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessToken>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  });
  const router = useRouter();
  const onSubmit: SubmitHandler<AccessToken> = async (data) => {
    try {
      await login(data);
      router.push("./dashboard");
    } catch (err) {
      const errDetail = (err as ApiError).body.detail;

      setError(errDetail);
    }
  };

  return (
    <>
      <Container
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        h="100vh"
        maxW="sm"
        alignItems="stretch"
        justifyContent="center"
        gap={4}
        centerContent
      >
        <Image
          src="logo.png"
          alt=" logo"
          height="auto"
          maxW="2xs"
          alignSelf="center"
        />
        <Container
          centerContent
          fontWeight={"bold"}
          fontSize={"xx-large"}
          mb={4}
        >
          Flock AGI
        </Container>
        <FormControl id="username" isInvalid={!!errors.username || !!error}>
          <Input
            id="username"
            {...register("username", {
              pattern: emailPattern,
            })}
            placeholder="Email"
            type="email"
          />
          {errors.username && (
            <FormErrorMessage>{errors.username.message}</FormErrorMessage>
          )}
        </FormControl>
        <FormControl id="password" isInvalid={!!error}>
          <InputGroup>
            <Input
              {...register("password")}
              type={show ? "text" : "password"}
              placeholder="Password"
              autoComplete="password"
            />
            <InputRightElement
              color="gray.400"
              _hover={{
                cursor: "pointer",
              }}
            >
              <Icon
                onClick={setShow.toggle}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <ViewOffIcon /> : <ViewIcon />}
              </Icon>
            </InputRightElement>
          </InputGroup>
          {error && <FormErrorMessage>{error}</FormErrorMessage>}
        </FormControl>
        <Center>
          <Link href="/recover-password" color="blue.500">
            Forgot password?
          </Link>
        </Center>
        <Button variant="primary" type="submit" isLoading={isSubmitting}>
          Log In
        </Button>
      </Container>
    </>
  );
}

export default Login;
