import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Radio,
  RadioGroup,
  Stack,
} from "@chakra-ui/react";
import React, { useEffect, useCallback } from "react";
import { Controller, UseFormReturn, useWatch } from "react-hook-form";

import {
  Body_uploads_create_upload,
  Body_uploads_update_upload,
} from "../../client";
import FileUpload from "../Common/FileUpload";

// 创建一个新的类型，包含两种上传类型的所有字段
type UploadFormData = Body_uploads_create_upload & Body_uploads_update_upload;

interface UploadFormProps {
  form: UseFormReturn<UploadFormData>;
  fileType: "file" | "web";
  setFileType: (value: "file" | "web") => void;
  isUpdating: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isLoading: boolean;
}

const UploadForm: React.FC<UploadFormProps> = ({
  form,
  fileType,
  setFileType,
  isUpdating,
  onSubmit,
  onCancel,
  isSubmitting,
  isLoading,
}) => {
  const {
    register,
    control,
    setValue,
    formState: { errors, isDirty, isValid },
  } = form;

  const watchFile = useWatch({ control, name: "file" }) as File[] | undefined;
  const watchWebUrl = useWatch({ control, name: "web_url" }) as string | undefined;

  const generateDefaultDescription = useCallback((name: string) => {
    return `useful for when you want to answer queries about the ${name}`;
  }, []);

  useEffect(() => {
    let fileName = "";

    if (fileType === "file" && watchFile && watchFile.length > 0) {
      fileName = watchFile[0].name;
    } else if (fileType === "web" && watchWebUrl) {
      fileName = watchWebUrl; // 使用完整的 URL 作为网页的名字
    }

    if (fileName && !isUpdating) {
      setValue("description", generateDefaultDescription(fileName), {
        shouldDirty: true,
      });
    }
  }, [watchFile, watchWebUrl, fileType, setValue, isUpdating, generateDefaultDescription]);

  return (
    <>
      <FormControl isInvalid={!!errors.name}>
        <FormLabel htmlFor="name">Name</FormLabel>
        <Input
          id="name"
          {...register("name", {
            pattern: {
              value: /^[a-zA-Z0-9_-]{1,64}$/,
              message: "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
            },
          })}
          placeholder="Please input the knowledge base name"
          type="text"
        />
        {errors.name && (
          <FormErrorMessage>{errors.name.message}</FormErrorMessage>
        )}
      </FormControl>
      <FormControl isInvalid={!!errors.description} mt={4}>
        <FormLabel htmlFor="description">Description</FormLabel>
        <Input
          id="description"
          {...register("description")}
          placeholder="Please input the knowledge base name description"
          type="text"
        />
      </FormControl>
      <FormControl isRequired mt={4}>
        <FormLabel>Upload Type</FormLabel>
        <RadioGroup value={fileType} onChange={setFileType}>
          <Stack direction="row">
            <Radio value="file">File</Radio>
            <Radio value="web">Web Page</Radio>
          </Stack>
        </RadioGroup>
      </FormControl>

      {fileType === "file" ? (
        <FileUpload
          name="file"
          acceptedFileTypes=".pdf,.docx,.pptx,.xlsx,.txt,.html,.md"
          isRequired={!isUpdating}
          placeholder="Your file"
          control={control}
        >
          Upload File
        </FileUpload>
      ) : (
        <FormControl isRequired mt={4}>
          <FormLabel>Web Page URL</FormLabel>
          <Input
            {...register("web_url", {
              required: "Web URL is required",
              pattern: {
                value: /^https?:\/\/.+/,
                message: "Invalid URL format",
              },
            })}
            placeholder="https://example.com"
          />
          {errors.web_url && (
            <FormErrorMessage>{errors.web_url.message}</FormErrorMessage>
          )}
        </FormControl>
      )}

      <Controller
        control={control}
        name="chunk_size"
        rules={{ required: true }}
        render={({
          field: { onChange, onBlur, value, name, ref },
          fieldState: { error },
        }) => (
          <FormControl mt={4} isRequired isInvalid={!!error}>
            <FormLabel htmlFor="chunk_size">Chunk Size</FormLabel>
            <NumberInput
              id="chunk_size"
              name={name}
              value={value ?? undefined}
              onChange={(_, valueAsNumber) => onChange(valueAsNumber)}
              onBlur={onBlur}
              min={0}
            >
              <NumberInputField ref={ref} />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <FormErrorMessage>{error?.message}</FormErrorMessage>
          </FormControl>
        )}
      />
      <Controller
        control={control}
        name="chunk_overlap"
        rules={{ required: true }}
        render={({
          field: { onChange, onBlur, value, name, ref },
          fieldState: { error },
        }) => (
          <FormControl mt={4} isRequired isInvalid={!!error}>
            <FormLabel htmlFor="chunk_overlap">Chunk Overlap</FormLabel>
            <NumberInput
              id="chunk_overlap"
              name={name}
              value={value ?? undefined}
              onChange={(_, valueAsNumber) => onChange(valueAsNumber)}
              onBlur={onBlur}
              min={0}
            >
              <NumberInputField ref={ref} />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <FormErrorMessage>{error?.message}</FormErrorMessage>
          </FormControl>
        )}
      />
      <Stack direction="row" spacing={4} mt={4}>
        <Button
          variant="primary"
          onClick={onSubmit}
          isLoading={isSubmitting || isLoading}
          isDisabled={!isDirty || !isValid}
        >
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </Stack>
    </>
  );
};

export default UploadForm;
export { type UploadFormData };
