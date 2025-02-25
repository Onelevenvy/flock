import React, { useState } from "react";
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
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ParameterSchema } from "../../types";

interface ParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (parameter: ParameterSchema) => void;
  parameter?: ParameterSchema;
  isEdit?: boolean;
  existingParameters?: ParameterSchema[];
}

const PARAMETER_TYPES = [
  {
    type: "str",
    label: "String",
    description: "A text value"
  },
  {
    type: "number",
    label: "Number",
    description: "A numeric value"
  }
];

const ParameterModal: React.FC<ParameterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  parameter,
  isEdit = false,
  existingParameters = [],
}) => {
  const { t } = useTranslation();
  
  const [parameterName, setParameterName] = useState("");
  const [formData, setFormData] = useState({
    type: "str",
    required: true,
    description: "",
  });
  const [nameError, setNameError] = useState("");

  const validateParameterName = (name: string) => {
    if (!name) {
      setNameError("Parameter name is required");
      return;
    }
    
    const exists = existingParameters.some(p => {
      const existingName = Object.keys(p)[0];
      return existingName === name && (!isEdit || existingName !== Object.keys(parameter || {})[0]);
    });

    if (exists) {
      setNameError("A parameter with this name already exists");
    } else {
      setNameError("");
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setParameterName(newName);
    validateParameterName(newName);
  };

  React.useEffect(() => {
    if (isOpen) {
      if (isEdit && parameter) {
        const paramName = Object.keys(parameter)[0];
        const paramData = parameter[paramName];
        setParameterName(paramName);
        setFormData(paramData);
      } else {
        setParameterName("");
        setFormData({
          type: "str",
          required: true,
          description: "",
        });
      }
    }
  }, [isOpen, isEdit, parameter]);

  const handleSave = () => {
    if (!parameterName || nameError) {
      return;
    }

    const parameter: ParameterSchema = {
      [parameterName]: {
        type: formData.type,
        required: formData.required,
        description: formData.description
      }
    };
    onSave(parameter);
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
          <VStack spacing={4} align="stretch">
            <FormControl isRequired isInvalid={!!nameError}>
              <FormLabel>Parameter Name</FormLabel>
              <Input
                value={parameterName}
                onChange={handleNameChange}
                placeholder="Enter parameter name"
              />
              {nameError && (
                <Text color="red.500" fontSize="sm">
                  {nameError}
                </Text>
              )}
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Type</FormLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({...prev, type: e.target.value}))}
              >
                {PARAMETER_TYPES.map((type) => (
                  <option key={type.type} value={type.type}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                placeholder="Enter parameter description"
              />
            </FormControl>

            <FormControl>
              <Checkbox
                isChecked={formData.required}
                onChange={(e) => setFormData(prev => ({...prev, required: e.target.checked}))}
              >
                Required
              </Checkbox>
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {t("workflow.nodes.parameterExtractor.modal.cancel")}
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleSave}
            isDisabled={!parameterName || !!nameError}
          >
            {t("workflow.nodes.parameterExtractor.modal.save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ParameterModal; 