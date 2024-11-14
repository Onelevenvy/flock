"use client";

import {
  Container,
  FormControl,
  Select,
  Box,
  Text,
  VStack,
  useColorModeValue,
  Icon,
} from "@chakra-ui/react";
import React, { type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "react-query";
import { MdLanguage, MdTranslate } from "react-icons/md";

import type { ApiError } from "@/client";
import { UsersService } from "@/client/services/UsersService";
import useAuth from "@/hooks/useAuth";
import useCustomToast from "@/hooks/useCustomToast";

const languages = [
  { code: "zh-Hans", name: "中文-简体", icon: MdTranslate },
  { code: "en-US", name: "English-US", icon: MdLanguage },
];

export default function LanguagePage() {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const { currentUser } = useAuth();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  const mutation = useMutation(
    (language: string) =>
      UsersService.updateUserLanguage({ requestBody: { language } }),
    {
      onSuccess: () => {
        showToast("Success!", "User language updated successfully.", "success");
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;
        showToast("Something went wrong.", `${errDetail}`, "error");
      },
      onSettled: () => {
        queryClient.invalidateQueries("users");
        queryClient.invalidateQueries("currentUser");
      },
    }
  );

  const onChangeLanguage = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedLanguage = event.target.value;
    mutation.mutate(selectedLanguage);
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
      >
        <VStack align="stretch" spacing={6}>
          <Text fontSize="lg" fontWeight="600" color="gray.800">
            Language Settings
          </Text>

          <FormControl>
            <Select
              defaultValue={currentUser?.language}
              onChange={onChangeLanguage}
              bg={inputBgColor}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="lg"
              fontSize="sm"
              h="45px"
              transition="all 0.2s"
              _hover={{
                borderColor: "gray.300",
              }}
              _focus={{
                borderColor: "ui.main",
                boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
              }}
              icon={<Icon as={MdLanguage} color="gray.400" boxSize={5} />}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Text fontSize="sm" color="gray.500" lineHeight="tall">
              Choose your preferred language for the interface. This setting will be saved and applied across all your sessions.
            </Text>
          </Box>
        </VStack>
      </Box>
    </Container>
  );
}
