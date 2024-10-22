import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";
import {
  type ApiError,
  type ApiKeyCreate,
  ApiKeysService,
} from "../../../client";
import useCustomToast from "../../../hooks/useCustomToast";
import { useState } from "react";
import CopyInput from "../../Common/CopyInput";

interface AddApiKeyProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
}

const AddApiKey = ({
  teamId,
  isOpen,
  onClose,
}: AddApiKeyProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ApiKeyCreate>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {},
  });

  const addApiKey = async (data: ApiKeyCreate) => {
    return await ApiKeysService.createApiKey({
      requestBody: data,
      teamId: Number.parseInt(teamId),
    });
  };

  const mutation = useMutation(addApiKey, {
    onSuccess: (data) => {
      showToast(
        "Success!",
        "API key created successfully.",
        "success"
      );
      setApiKey(data.key);
      reset();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("apikeys");
    },
  });

  const onSubmit: SubmitHandler<ApiKeyCreate> = (data) => {
    mutation.mutate(data);
  };

  const closeModalHandler = () => {
    onClose();
    setApiKey(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "sm", md: "md" }}
      isCentered
      closeOnOverlayClick={false}
    >
      <ModalOverlay />
      {!apiKey ? (
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            Create an API key
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isInvalid={!!errors.description}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Input
                id="description"
                {...register("description")}
                placeholder="Description..."
                type="text"
              />
              {errors.description && (
                <FormErrorMessage>
                  {errors.description.message}
                </FormErrorMessage>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting || mutation.isLoading}
              isDisabled={!isValid}
            >
              Create API key
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      ) : (
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Copy your new API key</ModalHeader>
          <ModalBody pb={6}>
            <CopyInput value={apiKey} />
          </ModalBody>
          <ModalFooter gap={3}>
            <Button onClick={closeModalHandler}>
              I&apos;ve copied the API key to a safe place
            </Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  );
};

export default AddApiKey;
