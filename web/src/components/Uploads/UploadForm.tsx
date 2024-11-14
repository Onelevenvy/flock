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
  VStack,
  useColorModeValue,
  Text,
  Box,
  HStack,
} from "@chakra-ui/react";
import React, { useEffect, useCallback } from "react";
import { Controller, UseFormReturn, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FiUpload, FiGlobe } from "react-icons/fi";

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
    formState: { errors },
  } = form;

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

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
    <VStack spacing={6} align="stretch">
      <FormControl isInvalid={!!errors.name}>
        <FormLabel 
          fontSize="sm"
          fontWeight="500"
          color="gray.700"
        >
          {t("knowledge.upload.form.name.label")}
        </FormLabel>
        <Input
          {...register("name", {
            pattern: {
              value: /^[a-zA-Z0-9_-]{1,64}$/,
              message: String(t("knowledge.upload.form.name.pattern")),
            },
          })}
          placeholder={String(t("knowledge.upload.form.name.placeholder"))}
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
        {errors.name && (
          <FormErrorMessage>{errors.name.message}</FormErrorMessage>
        )}
      </FormControl>

      <FormControl isInvalid={!!errors.description}>
        <FormLabel 
          fontSize="sm"
          fontWeight="500"
          color="gray.700"
        >
          {t("knowledge.upload.form.description.label")}
        </FormLabel>
        <Input
          {...register("description")}
          placeholder={t("knowledge.upload.form.description.placeholder") || "Enter initial input"}
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
      </FormControl>

      <FormControl isRequired>
        <FormLabel 
          fontSize="sm"
          fontWeight="500"
          color="gray.700"
        >
          {t("knowledge.upload.form.type.label")}
        </FormLabel>
        <RadioGroup value={fileType} onChange={setFileType}>
          <Stack direction="row" spacing={6}>
            <Radio 
              value="file" 
              colorScheme="blue"
              size="lg"
            >
              <HStack spacing={2}>
                <FiUpload />
                <Text>{t("knowledge.upload.form.type.file")}</Text>
              </HStack>
            </Radio>
            <Radio 
              value="web" 
              colorScheme="blue"
              size="lg"
            >
              <HStack spacing={2}>
                <FiGlobe />
                <Text>{t("knowledge.upload.form.type.web")}</Text>
              </HStack>
            </Radio>
          </Stack>
        </RadioGroup>
      </FormControl>

      {fileType === "file" ? (
        <Box
          bg={bgColor}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
          p={4}
          transition="all 0.2s"
          _hover={{
            borderColor: "gray.200",
            boxShadow: "sm",
          }}
        >
          <FileUpload
            name="file"
            acceptedFileTypes=".pdf,.docx,.pptx,.xlsx,.txt,.html,.md"
            isRequired={!isUpdating}
            placeholder={t("knowledge.upload.form.file.label") || "Enter initial input"}
            control={control}
          >
            {t("knowledge.upload.form.file.button")}
          </FileUpload>
        </Box>
      ) : (
        <FormControl isRequired>
          <FormLabel 
            fontSize="sm"
            fontWeight="500"
            color="gray.700"
          >
            {t("knowledge.upload.form.webUrl.label")}
          </FormLabel>
          <Input
            {...register("web_url", {
              required: String(t("knowledge.upload.error.required")),
              pattern: {
                value: /^https?:\/\/.+/,
                message: String(t("knowledge.upload.form.webUrl.error")),
              },
            })}
            placeholder={String(t("knowledge.upload.form.webUrl.placeholder"))}
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
          {errors.web_url && (
            <FormErrorMessage>{errors.web_url.message}</FormErrorMessage>
          )}
        </FormControl>
      )}

      <Controller
        control={control}
        name="chunk_size"
        rules={{ required: String(t("knowledge.upload.error.required")) }}
        render={({
          field: { onChange, onBlur, value, name, ref },
          fieldState: { error },
        }) => (
          <FormControl isRequired isInvalid={!!error}>
            <FormLabel 
              fontSize="sm"
              fontWeight="500"
              color="gray.700"
            >
              {t("knowledge.upload.form.chunkSize.label")}
            </FormLabel>
            <NumberInput
              id="chunk_size"
              name={name}
              value={value ?? undefined}
              onChange={(_, valueAsNumber) => onChange(valueAsNumber)}
              onBlur={onBlur}
              min={0}
              bg={inputBgColor}
              borderRadius="lg"
            >
              <NumberInputField 
                ref={ref}
                border="1px solid"
                borderColor={borderColor}
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
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
          <FormControl isRequired isInvalid={!!error}>
            <FormLabel 
              fontSize="sm"
              fontWeight="500"
              color="gray.700"
            >
              {t("knowledge.upload.form.chunkOverlap.label")}
            </FormLabel>
            <NumberInput
              id="chunk_overlap"
              name={name}
              value={value ?? undefined}
              onChange={(_, valueAsNumber) => onChange(valueAsNumber)}
              onBlur={onBlur}
              min={0}
              bg={inputBgColor}
              borderRadius="lg"
            >
              <NumberInputField 
                ref={ref}
                border="1px solid"
                borderColor={borderColor}
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <FormErrorMessage>{error?.message}</FormErrorMessage>
          </FormControl>
        )}
      />

      <Stack direction="row" spacing={4} justify="flex-end">
        <Button
          variant="primary"
          onClick={onSubmit}
          isLoading={isSubmitting || isLoading}
          transition="all 0.2s"
          _hover={{
            transform: "translateY(-1px)",
            boxShadow: "md",
          }}
          _active={{
            transform: "translateY(0)",
          }}
        >
          {t("knowledge.upload.form.actions.save")}
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
          }}
        >
          {t("knowledge.upload.form.actions.cancel")}
        </Button>
      </Stack>
    </VStack>
  );
};

export default UploadForm;
export { type UploadFormData };
