"use client";
import {
  Text,
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  useColorModeValue,
  IconButton,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  Badge,
} from "@chakra-ui/react";
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {  MdSearch, MdAdd } from "react-icons/md";
import { BsRobot } from "react-icons/bs";

import { SiBuildkite } from "react-icons/si";
import { TbApi } from "react-icons/tb";
import { FaBorderAll, FaMaxcdn } from "react-icons/fa";

import { type ApiError, ToolproviderService } from "@/client";
import TabSlider from "@/components/Common/TabSlider";
import ToolsIcon from "@/components/Icons/Tools/index";
import CredentialsPanel from "@/components/Tools/CredentialsPanel";
import useCustomToast from "@/hooks/useCustomToast";
import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";
import type { ToolProviderWithToolsListOut } from "@/client/models/ToolProviderWithToolsListOut";
import type { ToolProviderUpdate } from "@/client/models/ToolProviderUpdate";

import { CreateMcpForm } from "@/components/Tools/CreateMcpForm";

interface CreateButtonProps {
  onCreateTool: (type: 'api' | 'mcp') => void;
}

function CreateButton({ onCreateTool }: CreateButtonProps) {
  const { t } = useTranslation("tools");
  
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button leftIcon={<MdAdd />} colorScheme="blue">
          {t('create')}
        </Button>
      </PopoverTrigger>
      <PopoverContent width="200px">
        <PopoverBody p={2}>
          <Flex direction="column" gap={2}>
            <Button
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<TbApi />}
              onClick={() => onCreateTool('api')}
            >
              {t('createApi')}
            </Button>
            <Button
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<BsRobot />}
              onClick={() => onCreateTool('mcp')}
            >
              {t('createMcp')}
            </Button>
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

export default function Tools() {
  const showToast = useCustomToast();
  const { t } = useTranslation("tools");
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const hoverBorderColor = useColorModeValue("gray.200", "gray.600");
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchKey, setSearchKey] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ToolProviderWithToolsListOut | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Modal state for MCP form
  const { isOpen: showMcpForm, onOpen: openMcpForm, onClose: closeMcpForm } = useDisclosure();
  const [editMcpProvider, setEditMcpProvider] = useState<ToolProviderWithToolsListOut | null>(null);

  const {
    data: queryResult,
    isLoading,
    refetch,
    isError,
    error
  } = useToolProvidersQuery();

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const providers = queryResult?.providers || [];

  const filteredProviders = providers.filter(provider => {
    if (provider.provider_name === "ask_human") return false;
    if (searchKey && !provider.provider_name.toLowerCase().includes(searchKey.toLowerCase()) && 
        (!provider.display_name || !provider.display_name.toLowerCase().includes(searchKey.toLowerCase()))) {
      return false;
    }
    if (activeTab === 'all') return true;
    if (activeTab === 'builtin') return provider.tool_type === 'builtin';
    if (activeTab === 'api') return provider.tool_type === 'api';
    if (activeTab === 'mcp') return provider.tool_type === 'mcp';
    return true;
  });

  const handleCreateTool = useCallback((type: 'api' | 'mcp') => {
    if (type === 'mcp') {
      setEditMcpProvider(null); // 确保是创建模式
      openMcpForm();
    }
  }, [openMcpForm]);


  const handleFormSuccess = useCallback(() => {
    refetch();
    closeMcpForm();
  }, [refetch, closeMcpForm]);

  const handleProviderClick = (provider: ToolProviderWithToolsListOut) => {
    setSelectedProvider(provider);
  };

  const handleSaveCredentials = async (credentials: Record<string, any>) => {
    try {
      const updateData: ToolProviderUpdate = {
        provider_name: selectedProvider!.provider_name,
        description: selectedProvider!.description,
        credentials: credentials
      };
      
      await ToolproviderService.updateProvider({
        toolProviderId: selectedProvider!.id,
        requestBody: updateData
      });
      
      // 自动触发鉴权
      try {
        const authResult = await ToolproviderService.authenticateProvider({
          toolProviderId: selectedProvider!.id
        });
        
        if (authResult.success) {
          showToast(
            "Success",
            "Authentication successful",
            "success"
          );
        } else {
          showToast(
            "Error",
            authResult.message || "Authentication failed",
            "error"
          );
        }
      } catch (authError: any) {
        showToast(
          "Error",
          authError.message || "Authentication error",
          "error"
        );
      }
      
      // 刷新数据
      refetch();
      setSelectedProvider(null);
    } catch (error: any) {
      showToast(
        "Error",
        error.message || "Failed to save credentials",
        "error"
      );
    }
  };

  const handleEditMcp = (provider: ToolProviderWithToolsListOut) => {
    setEditMcpProvider(provider);
    openMcpForm();
    setSelectedProvider(null); // 关闭凭证面板
  };

  const handleDeleteMcp = async (provider: ToolProviderWithToolsListOut) => {
    setIsDeleting(true);
    try {
      await ToolproviderService.deleteProvider({ toolProviderId: provider.id });
      showToast("Success", "MCP provider deleted successfully", "success");
      setSelectedProvider(null); // 关闭凭证面板
      refetch(); // 刷新数据
    } catch (error: any) {
      showToast("Error", error.message || "Failed to delete MCP provider", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const typeOptions = [
    {
      value: "all",
      text: t("all"),
      icon: <FaBorderAll className="w-[14px] h-[14px]" />,
    },
    {
      value: "builtin",
      text: t("builtin"),
      icon: <SiBuildkite className="w-[14px] h-[14px]" />,
    },
    {
      value: "mcp",
      text: t("mcp"),
      icon: <FaMaxcdn className="w-[14px] h-[14px]" />,
    },
    {
      value: "api",
      text: t("api"),
      icon: <TbApi className="w-[14px] h-[14px]" />,
    }
  ];

  return (
    <Flex h="full" position="relative">
      <Box
        flex="1"
        bg="ui.bgMain"
        display="flex"
        flexDirection="column"
        h="full"
      >
        <Box px={10} py={10}>
          <Flex direction="row" justify="space-between" align="center">
            <Box>
              <TabSlider
                value={activeTab}
                onChange={setActiveTab}
                options={typeOptions}
              />
            </Box>
            <Flex align="center" gap={4}>
              <InputGroup size="md" width="150px" variant='outline'>
                <InputLeftElement pointerEvents="none">
                  <MdSearch color="gray.300" />
                </InputLeftElement>
                <Input 
                  placeholder="Search" 
                  onChange={(e) => setSearchKey(e.target.value)}
                />
              </InputGroup>
              <CreateButton onCreateTool={handleCreateTool} />
            </Flex>
          </Flex>
        </Box>

        <Box flex="1" overflowY="auto" px={10} pb={10} position="relative">
          {(isLoading || isDeleting) ? (
            <Flex justify="center" align="center" height="full" width="full">
              <Spinner size="xl" color="ui.main" thickness="3px" />
            </Flex>
          ) : (
            <SimpleGrid
              columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
              spacing={6}
              pb={20}
            >
              {filteredProviders.map((provider) => (
                <Box
                  key={provider.id}
                  onClick={() => handleProviderClick(provider)}
                  cursor="pointer"
                  bg={bgColor}
                  p={6}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={borderColor}
                  transition="all 0.2s"
                  _hover={{
                    transform: "translateY(-2px)",
                    boxShadow: "md",
                    borderColor: hoverBorderColor,
                  }}
                >
                  <HStack spacing={4} mb={4}>
                    <Box
                      borderRadius="lg"
                      bg={`${provider.tool_type === 'builtin' ? "blue" : "purple"}.50`}
                      as={IconButton}
                      aria-label={provider.provider_name}
                    >
                      <ToolsIcon
                        h="6"
                        w="6"
                        tools_name={(provider.icon || provider.provider_name!)
                        }
                        color={`${provider.tool_type === 'builtin' ? "blue" : "purple"}.500`}
                      />
                    </Box>
                    <Heading
                      size="md"
                      color="gray.700"
                      fontWeight="600"
                      noOfLines={1}
                    >
                      {provider.display_name || provider.provider_name}
                    </Heading>
                  </HStack>

                  <Box
                    overflow="hidden"
                    minH="55px"
                    h="55px"
                    maxH="55px"
                    mb={4}
                  >
                    <Text
                      color="gray.600"
                      fontSize="sm"
                      textOverflow="ellipsis"
                      noOfLines={2}
                    >
                      {provider.description}
                    </Text>
                  </Box>

                  <Flex justifyContent="space-between" alignItems="center">
                    
                      <Badge
                        size="sm"
                        variant="subtle"
                        colorScheme="blue"
                        borderRadius="full"
                        px={3}
                        py={1}
                      >
                  
                           {provider.tool_type}
                      </Badge>
                    <Box  className="text-sm text-muted-foreground">{provider.tools.length} 个工具</Box>
                  </Flex>
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Box>
      </Box>

      {selectedProvider && (
        <Box 
          position="fixed" 
          top="0" 
          right="0" 
          bottom="0" 
          left="0" 
          zIndex="50" 
          display="flex" 
          justifyContent="flex-end"
        >
          <Box 
            position="fixed" 
            inset="0" 
            bg="blackAlpha.600" 
            onClick={() => setSelectedProvider(null)} 
          />
          <Box 
            width="400px" 
            height="full" 
            mt="72px" 
            overflow="hidden" 
            position="relative" 
            zIndex="10" 
            mr="1"
          >
            <CredentialsPanel 
              skill={selectedProvider} 
              onClose={() => setSelectedProvider(null)} 
              onSave={handleSaveCredentials}
              onEditMcp={handleEditMcp}
              onDelete={handleDeleteMcp}
            />
          </Box>
        </Box>
      )}

      <Modal isOpen={showMcpForm} onClose={closeMcpForm} size="xl">
        <ModalOverlay />
        <ModalContent>
          <CreateMcpForm 
            isOpen={showMcpForm} 
            onClose={closeMcpForm} 
            onSuccess={handleFormSuccess}
            editProvider={editMcpProvider || undefined} 
          />
        </ModalContent>
      </Modal>
    </Flex>
  );
}
