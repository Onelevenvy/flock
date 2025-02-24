import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Checkbox,
  VStack,
  Textarea,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Parameter } from "../../types";

interface ParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (parameter: Parameter) => void;
  parameter?: Parameter;
  isEdit?: boolean;
}

const PARAMETER_TYPES = [
  "string",
  "number",
  "boolean",
  "array[string]",
  "array[number]",
  "array[object]"
];

const ParameterModal: React.FC<ParameterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  parameter,
  isEdit = false,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState<Parameter>({
    parameter_id: parameter?.parameter_id || "",
    name: parameter?.name || "",
    type: parameter?.type || "string",
    description: parameter?.description || "",
    required: parameter?.required ?? true,
  });

  React.useEffect(() => {
    if (parameter) {
      setFormData(parameter);
    }
  }, [parameter]);

  const handleChange = (
    field: keyof Parameter,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isEdit
            ? t("workflow.nodes.parameterExtractor.modal.editTitle")
            : t("workflow.nodes.parameterExtractor.modal.addTitle")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>
                {t("workflow.nodes.parameterExtractor.parameterName")}
              </FormLabel>
              <Input
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={t(
                  "workflow.nodes.parameterExtractor.namePlaceholder"
                )!}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>
                {t("workflow.nodes.parameterExtractor.parameterType")}
              </FormLabel>
              <Select
                value={formData.type}
                onChange={(e) => handleChange("type", e.target.value)}
              >
                {PARAMETER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>
                {t("workflow.nodes.parameterExtractor.parameterDescription")}
              </FormLabel>
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder={t(
                  "workflow.nodes.parameterExtractor.descriptionPlaceholder"
                )!}
                rows={3}
              />
            </FormControl>

            <Checkbox
              isChecked={formData.required}
              onChange={(e) => handleChange("required", e.target.checked)}
            >
              {t("workflow.nodes.parameterExtractor.required")}
            </Checkbox>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {t("workflow.nodes.parameterExtractor.modal.cancel")}
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            {t("workflow.nodes.parameterExtractor.modal.save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ParameterModal; 