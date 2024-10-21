import { ViewIcon, ViewOffIcon, QuestionIcon } from "@chakra-ui/icons";
import {
  Box,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  Tooltip,
  IconButton,
  CloseButton,
  HStack,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";

import { SkillOut } from "@/client";
import CustomButton from "@/components/Common/CustomButton";

interface CredentialsPanelProps {
  skill: SkillOut;
  onClose: () => void;
  onSave: (credentials: Record<string, any>) => void;
}

const CredentialsPanel: React.FC<CredentialsPanelProps> = ({
  skill,
  onClose,
  onSave,
}) => {
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );
 

  useEffect(() => {
    if (skill.credentials) {
      setCredentials(JSON.parse(JSON.stringify(skill.credentials)));
    } else {
      setCredentials({});
    }
  }, [skill]);

  const handleInputChange = (key: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value,
      },
    }));
  };

  const handleSave = () => {
    onSave(credentials);
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatLabel = (key: string) => {
    return key.replace(/_/g, " ");
  };

  return (
    <Box
      width="300px"
      p={4}
      borderLeft="1px"
      borderColor="gray.200"
      position="relative"
      maxH={"full"}
    >
      <CloseButton
        aria-label="Close panel"
        onClick={onClose}
        position="absolute"
        right="8px"
        top="8px"
        size="sm"
      />
      <Heading size="md" mb={4}>
        {skill.display_name}
      </Heading>
      <Text mb={4} color={"gray.500"}>
        {skill.description}
      </Text>
      {credentials && Object.keys(credentials).length > 0 ? (
        <VStack spacing={4}>
          {Object.entries(credentials).map(([key, credInfo]) => (
            <FormControl key={key}>
              <HStack spacing={2} mb={1}>
                <FormLabel mb={0}>{formatLabel(key)}</FormLabel>
                <Tooltip label={credInfo.description} placement="top">
                  <QuestionIcon boxSize={3} color="gray.500" />
                </Tooltip>
              </HStack>
              <InputGroup>
                <Input
                  type={showPasswords[key] ? "text" : "password"}
                  value={credInfo.value || ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={formatLabel(key)}
                />
                <InputRightElement width="4.5rem">
                  <IconButton
                    h="1.75rem"
                    size="sm"
                    onClick={() => togglePasswordVisibility(key)}
                    aria-label={
                      showPasswords[key] ? "Hide password" : "Show password"
                    }
                    icon={showPasswords[key] ? <ViewOffIcon /> : <ViewIcon />}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>
          ))}
          <CustomButton
            text="Save"
            variant="blue"
            onClick={handleSave}
            mt={4}
            width="100%"
          />
        </VStack>
      ) : (
        <Text>No credentials required for this tool.</Text>
      )}
    </Box>
  );
};

export default CredentialsPanel;
