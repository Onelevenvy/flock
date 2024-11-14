import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  Button,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import type { ModelProviderUpdate } from "@/client";
import type { ApiError } from "@/client/core/ApiError";
import { ProviderService } from "@/client/services/ProviderService";
import { useModelProviderContext } from "@/contexts/modelprovider";
import useCustomToast from "@/hooks/useCustomToast";

interface ProviderUpdateProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

export default function ProviderUpdate({
  isModalOpen,
  setIsModalOpen,
}: ProviderUpdateProps) {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const providerInfo = useModelProviderContext();
  const [show, setShow] = useState(false);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ModelProviderUpdate>({
    mode: "onBlur",
    criteriaMode: "all",
    values: {
      base_url: providerInfo!.base_url,
      api_key: providerInfo!.api_key,
      description: providerInfo!.description,
    },
  });

  const updateProvider = async (data: ModelProviderUpdate) => {
    return await ProviderService.updateProvider({
      modelProviderId: providerInfo!.id,
      requestBody: data,
    });
  };

  const mutation = useMutation(updateProvider, {
    onSuccess: (data) => {
      showToast("Success!", "Provider updated successfully.", "success");
      reset(data);
      setIsModalOpen(false);
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("providerId");
    },
  });

  const onSubmit: SubmitHandler<ModelProviderUpdate> = async (data) => {
    mutation.mutate(data);
  };

  const onCancel = () => {
    reset();
    setIsModalOpen(false);
    setShow(false);
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      size={{ base: "sm", md: "md" }}
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        bg={bgColor}
        borderRadius="xl"
        boxShadow="xl"
        border="1px solid"
        borderColor={borderColor}
        as="form"
        onSubmit={handleSubmit(onSubmit)}
      >
        <ModalHeader
          borderBottom="1px solid"
          borderColor={borderColor}
          py={4}
          fontSize="lg"
          fontWeight="600"
        >
          Model Provider Settings
        </ModalHeader>

        <ModalCloseButton
          position="absolute"
          right={4}
          top={4}
          borderRadius="full"
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "rotate(90deg)",
          }}
        />

        <ModalBody py={6}>
          <VStack spacing={6}>
            <FormControl isInvalid={!!errors.api_key}>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                API Key
              </FormLabel>
              <InputGroup size="md">
                <Input
                  {...register("api_key", { required: "API Key is required" })}
                  type={show ? "text" : "password"}
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
                <InputRightElement>
                  <IconButton
                    aria-label={show ? "Hide API key" : "Show API key"}
                    icon={show ? <ViewIcon /> : <ViewOffIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={() => setShow(!show)}
                    transition="all 0.2s"
                    borderRadius="lg"
                    _hover={{
                      bg: "gray.100",
                    }}
                  />
                </InputRightElement>
              </InputGroup>
              {errors.api_key && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {errors.api_key.message}
                </Text>
              )}
            </FormControl>

            <FormControl isInvalid={!!errors.base_url}>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                Base URL
              </FormLabel>
              <Input
                {...register("base_url", { required: "Base URL is required" })}
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
              {errors.base_url && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {errors.base_url.message}
                </Text>
              )}
            </FormControl>

            <FormControl isInvalid={!!errors.description}>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                Description
              </FormLabel>
              <Input
                {...register("description", {
                  required: "Description is required",
                })}
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
              {errors.description && (
                <Text fontSize="sm" color="red.500" mt={1}>
                  {errors.description.message}
                </Text>
              )}
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            isDisabled={!isDirty}
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
