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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
          fontSize="7xl"
          fontWeight="bold"
          color="white"
          textShadow="0 2px 4px rgba(0,0,0,0.2)"
          letterSpacing="tight"
          mb={4}
        >
          Flock
        </Text>
        <Text
          fontSize="2xl"
          color="white"
          lineHeight="1.8"
          opacity={0.95}
          fontWeight="500"
          mb={6}
        >
          <Text as="span" color="blue.300" fontWeight="bold">
            F
          </Text>
          {t("login.subtitle.flexible")}{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            L
          </Text>
          {t("login.subtitle.lowcode")}{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            O
          </Text>
          {t("login.subtitle.orchestrating")}{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            C
          </Text>
          {t("login.subtitle.collaborative")}{" "}
          <Text as="span" color="blue.300" fontWeight="bold">
            K
          </Text>
          {t("login.subtitle.kits")}
        </Text>
        <Text fontSize="2xl" color="white" lineHeight="1.8" opacity={0.9}>
          {t("login.subtitle.platform")}
        </Text>
        <Text
          fontSize="xl"
          color="white"
          mt={4}
          lineHeight="1.8"
          opacity={0.9}
          fontWeight="400"
        >
          {t("login.subtitle.features.line1")}
          <br />
          {t("login.subtitle.features.line2")}
          <br />
          {t("login.subtitle.features.line3")}
        </Text>
      </Box>

      <Flex
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        w="400px"
        bg="rgba(255, 255, 255, 0.1)"
        backdropFilter="blur(20px)"
        borderRadius="2xl"
        p={8}
        boxShadow="xl"
        flexDirection="column"
        gap={6}
        border="1px solid rgba(255, 255, 255, 0.2)"
      >
        <VStack spacing={6}>
          <Image
            src="logo.png"
            alt="logo"
            height="60px"
            width="auto"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
          />
          <Text
            fontSize="2xl"
            fontWeight="600"
            color="white"
            letterSpacing="tight"
          >
            {t("login.title")}
          </Text>

          <FormControl id="username" isInvalid={!!errors.username || !!error}>
            <Input
              id="username"
              {...register("username", {
                pattern: emailPattern,
              })}
              placeholder={t("login.form.email.placeholder")!}
              type="email"
              size="lg"
              bg="rgba(255, 255, 255, 0.08)"
              border="1px solid rgba(255, 255, 255, 0.2)"
              color="white"
              _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
              _hover={{
                bg: "rgba(255, 255, 255, 0.12)",
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
              _focus={{
                bg: "rgba(255, 255, 255, 0.12)",
                borderColor: "rgba(255, 255, 255, 0.4)",
                boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.4)",
              }}
              borderRadius="xl"
            />
            {errors.username && (
              <FormErrorMessage>{t("login.form.email.error")}</FormErrorMessage>
            )}
          </FormControl>

          <FormControl id="password" isInvalid={!!error}>
            <InputGroup size="lg">
              <Input
                {...register("password")}
                type={show ? "text" : "password"}
                placeholder={t("login.form.password.placeholder")!}
                autoComplete="password"
                bg="rgba(255, 255, 255, 0.08)"
                border="1px solid rgba(255, 255, 255, 0.2)"
                color="white"
                _placeholder={{ color: "rgba(255, 255, 255, 0.6)" }}
                _hover={{
                  bg: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                }}
                _focus={{
                  bg: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.4)",
                }}
                borderRadius="xl"
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
                  aria-label={
                    show
                      ? t("login.form.password.hide")!
                      : t("login.form.password.show")!
                  }
                >
                  {show ? <ViewOffIcon /> : <ViewIcon />}
                </Icon>
              </InputRightElement>
            </InputGroup>
            {error && (
              <FormErrorMessage>{t("login.form.error")}</FormErrorMessage>
            )}
          </FormControl>

          <Link
            href="/recover-password"
            color="white"
            opacity={0.8}
            alignSelf="flex-end"
            fontSize="sm"
            fontWeight="500"
            _hover={{
              textDecoration: "none",
              opacity: 1,
            }}
          >
            {t("login.form.password.forgot")}
          </Link>

          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            w="full"
            size="lg"
            bg="ui.main"
            color="white"
            _hover={{
              bg: "blue.500",
              transform: "translateY(-1px)",
            }}
            _active={{
              bg: "blue.600",
              transform: "translateY(0)",
            }}
            transition="all 0.2s"
            borderRadius="xl"
            fontSize="md"
            fontWeight="500"
          >
            {t("login.form.submit")}
          </Button>
        </VStack>
      </Flex>
    </Box>
  );
}

export default Login;
