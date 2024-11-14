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
  useColorModeValue,
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
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");
  const labelColor = useColorModeValue("gray.700", "gray.300");

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
      p={6}
      borderLeft="1px solid"
      borderColor={borderColor}
      bg={bgColor}
      position="relative"
      maxH="full"
      transition="all 0.2s"
      boxShadow="sm"
      _hover={{
        boxShadow: "md",
      }}
    >
      <CloseButton
        onClick={onClose}
        position="absolute"
        right={4}
        top={4}
        size="md"
        borderRadius="full"
        transition="all 0.2s"
        _hover={{
          bg: "gray.100",
          transform: "rotate(90deg)",
        }}
      />

      <VStack spacing={6} align="stretch">
        <Heading size="md" color="gray.800" fontWeight="600">
          {skill.display_name}
        </Heading>

        <Text color="gray.500" fontSize="sm" lineHeight="tall">
          {skill.description}
        </Text>

        {credentials && Object.keys(credentials).length > 0 ? (
          <VStack spacing={4}>
            {Object.entries(credentials).map(([key, credInfo]) => (
              <FormControl key={key}>
                <HStack spacing={2} mb={2}>
                  <FormLabel 
                    mb={0}
                    fontSize="sm"
                    fontWeight="500"
                    color={labelColor}
                  >
                    {formatLabel(key)}
                  </FormLabel>
                  <Tooltip 
                    label={credInfo.description} 
                    placement="top"
                    hasArrow
                    bg="gray.700"
                    color="white"
                    px={3}
                    py={2}
                    borderRadius="md"
                  >
                    <QuestionIcon boxSize={3} color="gray.400" />
                  </Tooltip>
                </HStack>
                <InputGroup size="md">
                  <Input
                    type={showPasswords[key] ? "text" : "password"}
                    value={credInfo.value || ""}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    placeholder={formatLabel(key)}
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
                  <InputRightElement>
                    <IconButton
                      aria-label={showPasswords[key] ? "Hide password" : "Show password"}
                      icon={showPasswords[key] ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePasswordVisibility(key)}
                      transition="all 0.2s"
                      borderRadius="lg"
                      _hover={{
                        bg: "gray.100",
                      }}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
            ))}
            <CustomButton
              text="Save"
              variant="blue"
              onClick={handleSave}
              width="full"
              transition="all 0.2s"
              _hover={{
                transform: "translateY(-1px)",
                boxShadow: "md",
              }}
              _active={{
                transform: "translateY(0)",
              }}
            />
          </VStack>
        ) : (
          <Text color="gray.500" fontSize="sm">
            No credentials required for this tool.
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default CredentialsPanel;
