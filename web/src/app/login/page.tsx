"use client";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  Button,
  FormControl,
  FormErrorMessage,
  Icon,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  useBoolean,
  Box,
  Flex,
  Text,
  VStack,
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
    <Box
      h="100vh"
      w="100vw"
      position="relative"
      // bgImage="src('https://images.unsplash.com/photo-1579548122080-c35fd6820ecb?q=80&w=2070&auto=format&fit=crop')"
      bgImage="bg.avif"
      bgSize="cover"
      bgPosition="center"
      overflow="hidden"
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      pr="15%"
    >
      <Box
        position="absolute"
        left="8%"
        top="30%"
        transform="translateY(-50%)"
        maxW="700px"
      >
        <Text
          fontSize="8xl"
          fontWeight="bold"
          color="white"
          textShadow="0 2px 4px rgba(0,0,0,0.2)"
        >
          Flock
        </Text>
        <Text
          fontSize="2xl"
          color="white"
          lineHeight="1.8"
          opacity={0.9}
          mb={8}
        >
          {/* Flexible Low-code Orchestrating Collaborative-agent Kits */}
          <Text as="span" color="blue.300" fontWeight="bold">
            F
          </Text>
          exible{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            L
          </Text>
          ow-code{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            O
          </Text>
          rchestrating{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            C
          </Text>
          ollaborative-agent &{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            K
          </Text>
          its
        </Text>
        <Text fontSize="2xl" color="white" lineHeight="1.8" opacity={0.9}>
          低代码 AI 应用开发平台
        </Text>
        <Text fontSize="xl" color="white" mt={4} lineHeight="1.6" opacity={0.8}>
          快速构建ChatBot、RAG和Muti-Agent应用
          <br />
          基于 LangGraph 和 Langchain 的可视化workflow
          <br />
          让LLM应用开发更简单高效
        </Text>
      </Box>

      <Flex
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        w="400px"
        bg="rgba(255, 255, 255, 0.15)"
        backdropFilter="blur(20px)"
        borderRadius="xl"
        p={8}
        boxShadow="xl"
        flexDirection="column"
        gap={6}
      >
        <VStack spacing={6}>
          <Image src="logo.png" alt="logo" height="60px" width="auto" />
          <Text fontSize="2xl" fontWeight="bold" color="white">
            欢迎回来
          </Text>

          <FormControl id="username" isInvalid={!!errors.username || !!error}>
            <Input
              id="username"
              {...register("username", {
                pattern: emailPattern,
              })}
              placeholder="邮箱地址"
              type="email"
              size="lg"
              bg="rgba(255, 255, 255, 0.1)"
              border="1px solid rgba(255, 255, 255, 0.2)"
              color="white"
              _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
              _hover={{
                bg: "rgba(255, 255, 255, 0.2)",
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
              _focus={{
                bg: "rgba(255, 255, 255, 0.2)",
                borderColor: "rgba(255, 255, 255, 0.4)",
                boxShadow: "none",
              }}
            />
            {errors.username && (
              <FormErrorMessage>{errors.username.message}</FormErrorMessage>
            )}
          </FormControl>

          <FormControl id="password" isInvalid={!!error}>
            <InputGroup size="lg">
              <Input
                {...register("password")}
                type={show ? "text" : "password"}
                placeholder="密码"
                autoComplete="password"
                bg="rgba(255, 255, 255, 0.1)"
                border="1px solid rgba(255, 255, 255, 0.2)"
                color="white"
                _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
                _hover={{
                  bg: "rgba(255, 255, 255, 0.2)",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                }}
                _focus={{
                  bg: "rgba(255, 255, 255, 0.2)",
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  boxShadow: "none",
                }}
              />
              <InputRightElement
                color="white"
                opacity={0.8}
                _hover={{
                  cursor: "pointer",
                  opacity: 1,
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

          <Link
            href="/recover-password"
            color="white"
            opacity={0.8}
            alignSelf="flex-end"
            fontSize="sm"
            _hover={{
              textDecoration: "none",
              opacity: 1,
            }}
          >
            忘记密码？
          </Link>

          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            w="full"
            size="lg"
            bg="rgba(255, 255, 255, 0.2)"
            color="white"
            _hover={{
              bg: "rgba(255, 255, 255, 0.3)",
            }}
            _active={{
              bg: "rgba(255, 255, 255, 0.4)",
            }}
          >
            登录
          </Button>
        </VStack>
      </Flex>
    </Box>
  );
}

export default Login;
