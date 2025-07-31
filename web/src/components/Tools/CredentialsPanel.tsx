import { CloseIcon, ViewIcon, ViewOffIcon, QuestionIcon, ChevronRightIcon } from "@chakra-ui/icons";
import {
  Box,
  VStack,
  Heading,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  Tooltip,
  IconButton,
  HStack,
  useColorModeValue,
  Button,
  Badge,
  Flex,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure
} from "@chakra-ui/react";
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ToolProviderWithToolsListOut } from "@/client/models/ToolProviderWithToolsListOut";
import { Tool } from "@/client/models/Tool";
import { ToolsService } from "@/client/services/ToolsService";
import { ToolproviderService } from "@/client/services/ToolproviderService";
import useCustomToast from "@/hooks/useCustomToast";
import { useQueryClient } from "react-query";
import { TbPointFilled } from "react-icons/tb";
import { FiEdit, FiTrash2, FiMoreHorizontal, FiRefreshCw } from "react-icons/fi";
import ToolsIcon from "@/components/Icons/Tools/index";

interface CredentialsPanelProps {
  skill: ToolProviderWithToolsListOut;
  onClose: () => void;
  onSave: (credentials: Record<string, any>) => void;
  onEditMcp?: (provider: ToolProviderWithToolsListOut) => void;
  onDelete?: (provider: ToolProviderWithToolsListOut) => void;
}

const CredentialsPanel: React.FC<CredentialsPanelProps> = ({
  skill,
  onClose,
  onSave,
  onEditMcp,
  onDelete,
}) => {
  const { t } = useTranslation("tools");
  const showToast = useCustomToast();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [toolDetails, setToolDetails] = useState<Record<string, Tool>>({});
  const [loadingTools, setLoadingTools] = useState<Record<string, boolean>>({});
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [providerState, setProviderState] = useState(skill);
  const { isOpen: showDeleteDialog, onOpen: openDeleteDialog, onClose: closeDeleteDialog } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 样式变量
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("gray.50", "gray.700");
  const labelColor = useColorModeValue("gray.700", "gray.300");
  const accordionBg = useColorModeValue("gray.50", "gray.700");
  const accordionHoverBg = useColorModeValue("gray.100", "gray.600");

  // 只有MCP类型的工具提供者才显示三点菜单
  const isMcpProvider = providerState.tool_type === 'mcp';

  useEffect(() => {
    if (skill.credentials) {
      setCredentials(JSON.parse(JSON.stringify(skill.credentials)));
    } else {
      setCredentials({});
    }
    setProviderState(skill);
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

  const handleEditClick = () => {
    if (onEditMcp) {
      onEditMcp(providerState);
    }
  };

  const handleDeleteClick = () => {
    openDeleteDialog();
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(providerState);
    }
    closeDeleteDialog();
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      const response = await ToolproviderService.authenticateProvider({ toolProviderId: providerState.id });

      if (response.success) {
        showToast(
          "Success",
          response.message || "Authentication successful",
          "success"
        );
        await queryClient.invalidateQueries("toolproviders");
      } else {
        showToast(
          "Error",
          response.message || "Authentication failed",
          "error"
        );
      }
    } catch (error) {
      showToast(
        "Error",
        "Failed to authenticate",
        "error"
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const formatLabel = (key: string) => {
    if (key in (credentials || {})) {
      return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return key;
  };

  const handleToolClick = async (toolId: number) => {
    if (toolDetails[toolId]) return;

    setLoadingTools((prev) => ({ ...prev, [toolId]: true }));
    try {
      const result = await ToolsService.readTool({ providerId: providerState.id });
      const tool = result.data.find(t => t.id === toolId);
      if (tool) {
        setToolDetails((prev) => ({ ...prev, [toolId]: tool }));
      }
    } catch (error) {
      showToast(
        "Error",
        "Failed to load tool details",
        "error"
      );
    } finally {
      setLoadingTools((prev) => ({ ...prev, [toolId]: false }));
    }
  };

  const getParameterType = (param: any) => {
    if (!param.type) return "any";
    if (typeof param.type === "string") return param.type;
    if (Array.isArray(param.type)) return param.type.join(" | ");
    return JSON.stringify(param.type);
  };

  return (
    <Box
      width="400px"
      borderLeft="1px solid"
      borderColor={borderColor}
      bg={bgColor}
      height="calc(100vh - 78px)"
      borderRadius="lg"
      boxShadow="xl"
      p={6}
      // ** MODIFICATION START **
      // 1. 将根 Box 变成一个垂直的 Flex 容器
      display="flex"
      flexDirection="column"
      gap={4} // 在 Flex 项目之间添加间隙
      // ** MODIFICATION END **
    >
      {/* Item 1: Top controls (Close and Options) */}
      <Flex justifyContent="space-between" alignItems="center">
        <IconButton
          aria-label="Close"
          icon={<CloseIcon />}
          size="sm"
          borderRadius="full"
          onClick={onClose}
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "rotate(90deg)",
          }}
        />

        {isMcpProvider && (
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="Options"
              icon={<FiMoreHorizontal />}
              variant="ghost"
              size="sm"
              borderRadius="full"
            />
            <MenuList>
              {onEditMcp && (
                <MenuItem icon={<FiEdit />} onClick={handleEditClick}>
                  Edit
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem icon={<FiTrash2 />} onClick={handleDeleteClick} color="red.500">
                  Delete
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        )}
      </Flex>

      {/* Item 2: Provider Header */}
      <Box borderBottom="1px solid" borderColor={borderColor} pb={4}>
        <Flex alignItems="center" justifyContent="space-between" mb={2}>
          <HStack>
            <Box
              width="40px"
              height="40px"
              borderRadius="lg"
              bg={`${providerState.tool_type === 'builtin' ? "blue" : "purple"}.50`}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <ToolsIcon
                h="6"
                w="6"
                tools_name={(providerState.icon || providerState.provider_name)
                  .toLowerCase()
                  .replace(/ /g, "_")}
                color={`${providerState.tool_type === 'builtin' ? "blue" : "purple"}.500`}
              />
            </Box>
            <Heading size="md" fontWeight="600">
              {providerState.display_name || providerState.provider_name}
            </Heading>
          </HStack>
          {providerState.is_available ? (
            <TbPointFilled color="green" size={20} />
          ) : (
            <Badge colorScheme="orange" variant="outline" display="flex" alignItems="center" gap={1}>
              Unavailable
              <TbPointFilled color="orange" size={20} />
            </Badge>
          )}
        </Flex>
        <Text fontSize="sm" color="gray.600">
          {providerState.description || "No description available"}
        </Text>
      </Box>

      {/* ** MODIFICATION START ** */}
      {/* Item 3: Scrollable Content Area */}
      {/* 2. 这个 Box 将占据所有剩余空间并提供滚动 */}
      <Box flex="1" overflowY="auto" pr={2}> 
      {/* ** MODIFICATION END ** */}
        <VStack spacing={8} align="stretch">
          {credentials && Object.keys(credentials).length > 0 && (
            <Box>
              <HStack spacing={2} mb={4}>
                <ChevronRightIcon />
                <Text fontSize="sm" fontWeight="semibold">
                  Provider Credentials
                </Text>
              </HStack>
              <VStack spacing={4} align="stretch">
                {Object.entries(credentials).map(([key, credInfo]) => (
                  <Box key={key} bg="gray.50" p={4} borderRadius="lg">
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
                        pr="4.5rem"
                        transition="all 0.2s"
                        _hover={{
                          borderColor: "gray.300",
                        }}
                        _focus={{
                          borderColor: "blue.500",
                          boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                        }}
                      />
                      <InputRightElement width="4.5rem">
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
                  </Box>
                ))}
              </VStack>
              <Button
                mt={4}
                colorScheme="blue"
                onClick={handleSave}
                width="full"
                isLoading={isAuthenticating}
                loadingText="Authorizing"
              >
                Authorize
              </Button>
            </Box>
          )}

          {/* Tools List */}
          <Box>
            <Flex alignItems="center" justifyContent="space-between" mb={4}>
              <HStack spacing={2}>
                <ChevronRightIcon />
                <Text fontSize="sm" fontWeight="semibold">
                  Available Tools
                </Text>
              </HStack>
              {isMcpProvider && (
                <Button
                  size="sm"
                  leftIcon={<FiRefreshCw />}
                  onClick={handleAuthenticate}
                  isLoading={isAuthenticating}
                  loadingText="Refreshing"
                  variant="outline"
                >
                  Refresh Tools
                </Button>
              )}
            </Flex>
            {providerState.tools.length > 0 ? (
              <Accordion allowToggle>
                {providerState.tools.map((tool) => (
                  <AccordionItem
                    key={tool.id}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="lg"
                    mb={2}
                    overflow="hidden"
                  >
                    <AccordionButton
                      bg={accordionBg}
                      _hover={{ bg: accordionHoverBg }}
                      px={4}
                      py={3}
                      onClick={() => handleToolClick(tool.id)}
                    >
                      <Flex flex="1" textAlign="left" justifyContent="space-between" alignItems="center">
                        <Text fontSize="sm" fontWeight="medium">
                          {tool.display_name || tool.name}
                        </Text>
                        <Badge
                          colorScheme={tool.is_online ? "green" : "red"}
                          variant="subtle"
                        >
                          {tool.is_online ? "Online" : "Offline"}
                        </Badge>
                      </Flex>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4} bg={bgColor}>
                      <VStack spacing={4} align="stretch">
                        <Text fontSize="sm" color="gray.600">
                          {tool.description}
                        </Text>
                        {loadingTools[tool.id] ? (
                          <Flex justify="center" py={4}>
                            <Spinner size="md" color="blue.500" />
                          </Flex>
                        ) : toolDetails[tool.id]?.input_parameters ? (
                          <Box>
                            <Text fontSize="sm" fontWeight="medium" mb={3}>
                              Parameters
                            </Text>
                            <VStack spacing={3} align="stretch">
                              {Object.entries(toolDetails[tool.id].input_parameters || {}).map(
                                ([key, param]) => (
                                  <Box
                                    key={key}
                                    bg={accordionBg}
                                    p={3}
                                    borderRadius="md"
                                  >
                                    <Flex alignItems="center" justifyContent="space-between" mb={1}>
                                      <Text fontWeight="medium" fontSize="sm">
                                        {formatLabel(key)}
                                      </Text>
                                      <Badge variant="solid" colorScheme="blue" fontSize="xs">
                                        {getParameterType(param)}
                                      </Badge>
                                    </Flex>
                                    <Text fontSize="sm" color="gray.600">
                                      {param.description}
                                    </Text>
                                  </Box>
                                ),
                              )}
                            </VStack>
                          </Box>
                        ) : null}
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <Text fontSize="sm" color="gray.500" fontStyle="italic">
                No tools available
              </Text>
            )}
          </Box>
        </VStack>
      </Box>

      <AlertDialog
        isOpen={showDeleteDialog}
        leastDestructiveRef={cancelRef as any}
        onClose={closeDeleteDialog}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Provider
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete {providerState.display_name || providerState.provider_name}? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleConfirmDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default CredentialsPanel;