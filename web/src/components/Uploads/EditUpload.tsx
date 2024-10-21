import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

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
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [fileType, setFileType] = useState<"file" | "web">(
    upload.file_type === "web" ? "web" : "file"
  );

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
        showToast("Success!", "Upload updated successfully.", "success");
        form.reset(data);
        onClose();
        queryClient.invalidateQueries("uploads");
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;

        showToast("Something went wrong.", `${errDetail}`, "error");
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
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Upload</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
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
