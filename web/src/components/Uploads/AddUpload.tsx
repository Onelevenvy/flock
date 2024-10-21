import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import UploadForm, { UploadFormData } from "./UploadForm";
import {
  type ApiError,
  type Body_uploads_create_upload,
  UploadsService,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface AddUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddUpload = ({ isOpen, onClose }: AddUploadProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const [fileType, setFileType] = useState<"file" | "web">("file");

  const form = useForm<UploadFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      chunk_size: 500,
      chunk_overlap: 50,
      description: "",
    },
  });

  const mutation = useMutation(
    (data: Body_uploads_create_upload) =>
      UploadsService.createUpload({
        formData: data as unknown as Body_uploads_create_upload,
      }),
    {
      onSuccess: () => {
        showToast("Success", "Upload created successfully", "success");
        form.reset();
        onClose();
        queryClient.invalidateQueries("uploads");
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;

        showToast("Something went wrong.", `${errDetail}`, "error");
      },
    }
  );

  const onSubmit: SubmitHandler<Body_uploads_create_upload> = (data) => {
    mutation.mutate({
      ...data,
      file_type: fileType,
    });
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
        <ModalHeader>Add Upload</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <UploadForm
            form={form}
            fileType={fileType}
            setFileType={setFileType}
            isUpdating={false}
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

export default AddUpload;
