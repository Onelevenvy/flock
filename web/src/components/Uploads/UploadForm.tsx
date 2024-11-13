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
import { useTranslation } from "react-i18next";

import {
  Body_uploads_create_upload,
  Body_uploads_update_upload,
} from "../../client";
import FileUpload from "../Common/FileUpload";

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
  const { t } = useTranslation();
  const {
    register,
    control,
    setValue,
    formState: { errors, isDirty, isValid },
  } = form;

  const watchFile = useWatch({ control, name: "file" }) as File[] | undefined;
  const watchWebUrl = useWatch({ control, name: "web_url" }) as string | undefined;

  const generateDefaultDescription = useCallback((name: string) => {
    return t("knowledge.upload.form.description.default", { name });
  }, [t]);

  useEffect(() => {
    let fileName = "";

    if (fileType === "file" && watchFile && watchFile.length > 0) {
      fileName = watchFile[0].name;
    } else if (fileType === "web" && watchWebUrl) {
      fileName = watchWebUrl;
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
        <FormLabel htmlFor="name">{t("knowledge.upload.form.name.label")}</FormLabel>
        <Input
          id="name"
          {...register("name", {
            pattern: {
              value: /^[a-zA-Z0-9_-]{1,64}$/,
              message: String(t("knowledge.upload.form.name.pattern")),
            },
          })}
          placeholder={String(t("knowledge.upload.form.name.placeholder"))}
          type="text"
        />
        {errors.name && (
          <FormErrorMessage>{errors.name.message}</FormErrorMessage>
        )}
      </FormControl>

      <FormControl isInvalid={!!errors.description} mt={4}>
        <FormLabel htmlFor="description">{t("knowledge.upload.form.description.label")}</FormLabel>
        <Input
          id="description"
          {...register("description")}
          placeholder={t("knowledge.upload.form.description.placeholder")|| "Enter initial input"}
          type="text"
        />
      </FormControl>

      <FormControl isRequired mt={4}>
        <FormLabel>{t("knowledge.upload.form.type.label")}</FormLabel>
        <RadioGroup value={fileType} onChange={setFileType}>
          <Stack direction="row">
            <Radio value="file">{t("knowledge.upload.form.type.file")}</Radio>
            <Radio value="web">{t("knowledge.upload.form.type.web")}</Radio>
          </Stack>
        </RadioGroup>
      </FormControl>

      {fileType === "file" ? (
        <FileUpload
          name="file"
          acceptedFileTypes=".pdf,.docx,.pptx,.xlsx,.txt,.html,.md"
          isRequired={!isUpdating}
          placeholder={t("knowledge.upload.form.file.label")|| "Enter initial input"}
          control={control}
        >
          {t("knowledge.upload.form.file.button")}
        </FileUpload>
      ) : (
        <FormControl isRequired mt={4}>
          <FormLabel>{t("knowledge.upload.form.webUrl.label")}</FormLabel>
          <Input
            {...register("web_url", {
              required: String(t("knowledge.upload.error.required")),
              pattern: {
                value: /^https?:\/\/.+/,
                message: String(t("knowledge.upload.form.webUrl.error")),
              },
            })}
            placeholder={String(t("knowledge.upload.form.webUrl.placeholder"))}
          />
          {errors.web_url && (
            <FormErrorMessage>{errors.web_url.message}</FormErrorMessage>
          )}
        </FormControl>
      )}

      <Controller
        control={control}
        name="chunk_size"
        rules={{ 
          required: String(t("knowledge.upload.error.required"))
        }}
        render={({
          field: { onChange, onBlur, value, name, ref },
          fieldState: { error },
        }) => (
          <FormControl mt={4} isRequired isInvalid={!!error}>
            <FormLabel htmlFor="chunk_size">{t("knowledge.upload.form.chunkSize.label")}</FormLabel>
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
            <FormLabel htmlFor="chunk_overlap">{t("knowledge.upload.form.chunkOverlap.label")}</FormLabel>
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
          {t("knowledge.upload.form.actions.save")}
        </Button>
        <Button onClick={onCancel}>
          {t("knowledge.upload.form.actions.cancel")}
        </Button>
      </Stack>
    </>
  );
};

export default UploadForm;
export { type UploadFormData };
