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
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);

  return (
    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader>Model Provider</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl isInvalid={!!errors.api_key}>
            <FormLabel>API Key</FormLabel>
            <InputGroup size="md">
              <Input
                pr="4.5rem"
                type={show ? "text" : "password"}
                id="api_key"
                {...register("api_key", { required: "API Key是必填项" })}
              />
              <InputRightElement>
                <IconButton
                  aria-label="api_key"
                  icon={show ? <ViewIcon /> : <ViewOffIcon />}
                  onClick={handleClick}
                />
              </InputRightElement>
            </InputGroup>

            {errors.api_key && (
              <Text as="span" color="red.500">
                {errors.api_key.message}
              </Text>
            )}
          </FormControl>
          <FormControl isInvalid={!!errors.base_url}>
            <FormLabel>Base URL</FormLabel>
            <Input
              id="base_url"
              {...register("base_url", { required: "Base_URL 是必填项" })}
            />
            {errors.base_url && (
              <Text as="span" color="red.500">
                {errors.base_url.message}
              </Text>
            )}
          </FormControl>
          <FormControl isInvalid={!!errors.description}>
            <FormLabel>Description</FormLabel>
            <Input
              id="description"
              {...register("description", { required: "描述是必填项" })}
            />
            {errors.description && (
              <Text as="span" color="red.500">
                {errors.description.message}
              </Text>
            )}
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button
            colorScheme="blue"
            mr="3"
            type="submit"
            isLoading={isSubmitting}
            isDisabled={!isDirty}
            onClick={() => {
              setShow(false);
            }}
          >
            保存
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
