import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";
import { useTranslation } from "react-i18next";

import UploadForm, { UploadFormData } from "./UploadForm";
import {
  type ApiError,
  type UploadOut,
  UploadsService,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface EditUploadProps {
  upload: UploadOut;
  isOpen: boolean;
  onClose: () => void;
}

const EditUpload = ({ upload, isOpen, onClose }: EditUploadProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [fileType, setFileType] = useState<"file" | "web">(
    upload.file_type === "web" ? "web" : "file"
  );

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  const form = useForm<UploadFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      ...upload,
      chunk_size: 500,
      chunk_overlap: 50,
    },
  });

  useEffect(() => {
    setFileType(upload.file_type === "web" ? "web" : "file");
    form.reset({
      ...upload,
      chunk_size: 500,
      chunk_overlap: 50,
    });
  }, [upload, form]);

  const mutation = useMutation(
    (data: UploadFormData) =>
      UploadsService.updateUpload({
        id: upload.id,
        formData: data,
        contentLength: data.file?.size || 0,
      }),
    {
      onSuccess: (data) => {
        showToast("Success", t("knowledge.upload.edit.success"), "success");
        form.reset(data);
        onClose();
        queryClient.invalidateQueries("uploads");
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;
        showToast(t("knowledge.upload.error.generic"), `${errDetail}`, "error");
      },
    }
  );

  const onSubmit: SubmitHandler<UploadFormData> = (data) => {
    mutation.mutate(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
      >
        <ModalHeader 
          borderBottom="1px solid"
          borderColor={borderColor}
          py={4}
          fontSize="lg"
          fontWeight="600"
        >
          {t("knowledge.upload.edit.title")}
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
          <UploadForm
            form={form}
            fileType={fileType}
            setFileType={setFileType}
            isUpdating={true}
            onSubmit={form.handleSubmit(onSubmit)}
            onCancel={onClose}
            isSubmitting={form.formState.isSubmitting}
            isLoading={mutation.isLoading}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default EditUpload;
