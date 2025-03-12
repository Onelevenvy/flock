import {
  Box,
  Text,
  VStack,
  useToast,
  Button,
  useDisclosure,
  HStack,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Badge,
} from "@chakra-ui/react";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AddIcon, EditIcon, DeleteIcon } from "@chakra-ui/icons";

import ModelSelect from "@/components/Common/ModelProvider";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useModelQuery } from "@/hooks/useModelQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import { useForm } from "react-hook-form";
import ServerModal from "./ServerModal";
import { ToolsService } from "@/client/services/ToolsService";

interface ServerConfig {
  name: string;
  transport: "stdio" | "sse";
  command?: "python" | "node";
  args?: string[];
  url?: string;
  tools?: any[];
}

interface FormValues {
  model: string;
  provider: string;
}

interface MCPNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const ServerCard: React.FC<{
  server: ServerConfig;
  onEdit: () => void;
  onDelete: () => void;
  tools: any[];
  isLoadingTools: boolean;
}> = ({ server, onEdit, onDelete, tools, isLoadingTools }) => {
  const { t } = useTranslation();
  const transportType =
    server.transport === "stdio"
      ? t("workflow.nodes.mcp.serverType.stdio")
      : t("workflow.nodes.mcp.serverType.sse");

  const getServerDetails = () => {
    if (server.transport === "stdio") {
      return (
        <VStack spacing={2} align="stretch">
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.500" width="100px">
              {t("workflow.nodes.mcp.serverName")}:
            </Text>
            <Text fontSize="xs" fontWeight="500">
              {server.name}
            </Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.500" width="100px">
              {t("workflow.nodes.mcp.transport")}:
            </Text>
            <Badge colorScheme="green" fontSize="xs">
              {transportType}
            </Badge>
          </HStack>
          <HStack spacing={2} alignItems="flex-start">
            <Text fontSize="xs" color="gray.500" width="100px">
              {t("workflow.nodes.mcp.command")}:
            </Text>
            <Text fontSize="xs" fontWeight="500">
              {server.command}
            </Text>
          </HStack>
          <Box mt={2}>
            <Text fontSize="xs" color="gray.500" mb={2}>
              {t("workflow.nodes.mcp.toolsList")}:
            </Text>
            {isLoadingTools ? (
              <Box p={2}>
                <Text fontSize="xs" color="gray.500">
                  {t("workflow.nodes.mcp.loadingTools")}
                </Text>
              </Box>
            ) : tools && tools.length > 0 ? (
              <VStack spacing={2} align="stretch">
                {tools.map((tool, index) => (
                  <Box
                    key={index}
                    p={2}
                    borderWidth={1}
                    borderRadius="sm"
                    borderColor="gray.200"
                  >
                    <Text fontSize="xs" fontWeight="500">
                      {tool.name}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {tool.description}
                    </Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text fontSize="xs" color="gray.500">
                {t("workflow.nodes.mcp.noToolsAvailable")}
              </Text>
            )}
          </Box>
        </VStack>
      );
    }
    return (
      <VStack spacing={2} align="stretch">
        <HStack spacing={2}>
          <Text fontSize="xs" color="gray.500" width="100px">
            {t("workflow.nodes.mcp.serverName")}:
          </Text>
          <Text fontSize="xs" fontWeight="500">
            {server.name}
          </Text>
        </HStack>
        <HStack spacing={2}>
          <Text fontSize="xs" color="gray.500" width="100px">
            {t("workflow.nodes.mcp.transport")}:
          </Text>
          <Badge colorScheme="purple" fontSize="xs">
            {transportType}
          </Badge>
        </HStack>
        <HStack spacing={2} alignItems="flex-start">
          <Text fontSize="xs" color="gray.500" width="100px">
            {t("workflow.nodes.mcp.sseUrl")}:
          </Text>
          <Text fontSize="xs" color="gray.600" isTruncated title={server.url}>
            {server.url}
          </Text>
        </HStack>
        <Box mt={2}>
          <Text fontSize="xs" color="gray.500" mb={2}>
            {t("workflow.nodes.mcp.toolsList")}:
          </Text>
          {isLoadingTools ? (
            <Box p={2}>
              <Text fontSize="xs" color="gray.500">
                {t("workflow.nodes.mcp.loadingTools")}
              </Text>
            </Box>
          ) : tools && tools.length > 0 ? (
            <VStack spacing={2} align="stretch">
              {tools.map((tool, index) => (
                <Box
                  key={index}
                  p={2}
                  borderWidth={1}
                  borderRadius="sm"
                  borderColor="gray.200"
                >
                  <Text fontSize="xs" fontWeight="500">
                    {tool.name}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {tool.description}
                  </Text>
                </Box>
              ))}
            </VStack>
          ) : (
            <Text fontSize="xs" color="gray.500">
              {t("workflow.nodes.mcp.noToolsAvailable")}
            </Text>
          )}
        </Box>
      </VStack>
    );
  };

  return (
    <Box
      p={4}
      borderWidth={1}
      borderRadius="md"
      borderColor="gray.200"
      transition="all 0.2s"
      _hover={{
        borderColor: "blue.200",
        shadow: "sm",
      }}
    >
      <VStack spacing={3} align="stretch">
        <HStack justify="flex-end">
          <IconButton
            aria-label={t("workflow.nodes.mcp.editServer")!}
            icon={<EditIcon />}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
          <IconButton
            aria-label={t("workflow.nodes.mcp.deleteServer")!}
            icon={<DeleteIcon />}
            size="sm"
            variant="ghost"
            colorScheme="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </HStack>
        {getServerDetails()}
      </VStack>
    </Box>
  );
};

const MCPNodeProperties: React.FC<MCPNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [inputText, setInputText] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const [editingServer, setEditingServer] = useState<
    ServerConfig | undefined
  >();
  const [deletingServer, setDeletingServer] = useState<
    ServerConfig | undefined
  >();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isLoadingTools, setIsLoadingTools] = useState<Record<string, boolean>>(
    {}
  );

  const { control, setValue } = useForm<FormValues>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      model: node.data.model || "",
      provider: node.data.provider || "",
    },
  });

  const { data: models, isLoading: isLoadingModel } = useModelQuery();

  const updateMCPConfig = useCallback(
    (newServers: ServerConfig[]) => {
      const mcp_config = newServers.reduce(
        (acc, server) => {
          if (!server.name) return acc;

          if (server.transport === "stdio") {
            acc[server.name] = {
              command: server.command || "python",
              args: server.args || [],
              transport: "stdio",
            };
          } else {
            acc[server.name] = {
              url: server.url || "",
              transport: "sse",
            };
          }
          return acc;
        },
        {} as Record<string, any>
      );

      onNodeDataChange(node.id, "mcp_config", mcp_config);
    },
    [node.id, onNodeDataChange]
  );

  const fetchTools = useCallback(
    async (serverConfig: ServerConfig) => {
      setIsLoadingTools((prev) => ({ ...prev, [serverConfig.name]: true }));
      try {
        const mcp_config = {
          [serverConfig.name]:
            serverConfig.transport === "stdio"
              ? {
                  command: serverConfig.command || "python",
                  args: serverConfig.args || [],
                  transport: "stdio",
                }
              : {
                  url: serverConfig.url || "",
                  transport: "sse",
                },
        };

        const data = await ToolsService.getMcpTools({
          requestBody: mcp_config,
        });

        if (data && data.tools) {
          setServers((currentServers) => {
            const updatedServers = currentServers.map((s) =>
              s.name === serverConfig.name ? { ...s, tools: data.tools } : s
            );
            // 更新 server_tools
            const serverTools = updatedServers.reduce(
              (acc, server) => {
                if (server.tools) {
                  acc[server.name] = server.tools;
                }
                return acc;
              },
              {} as Record<string, any>
            );
            onNodeDataChange(node.id, "server_tools", serverTools);
            updateMCPConfig(updatedServers);
            return updatedServers;
          });
        }
      } catch (error) {
        console.error("Error fetching tools:", error);
        toast({
          title: t("workflow.nodes.mcp.toolsFetchError"),
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsLoadingTools((prev) => ({ ...prev, [serverConfig.name]: false }));
      }
    },
    [node.id, onNodeDataChange, t, toast, updateMCPConfig]
  );

  useEffect(() => {
    if (node && node.data.input !== undefined) {
      setInputText(node.data.input);
    }
    if (node && node.data.model) {
      setValue("model", node.data.model);
    }
    if (node && node.data.mcp_config) {
      const serverConfigs: ServerConfig[] = Object.entries(
        node.data.mcp_config
      ).map(([name, config]: [string, any]) => ({
        name,
        transport: config.transport,
        ...(config.transport === "stdio"
          ? {
              command: config.command,
              args: config.args,
            }
          : {
              url: config.url,
            }),
        tools: node.data.server_tools?.[name] || [],
      }));
      setServers(serverConfigs);
    }
  }, [node, setValue]);

  const onModelSelect = useCallback(
    (modelName: string) => {
      const selectedModel = models?.data.find(
        (model) => model.ai_model_name === modelName
      );

      if (selectedModel) {
        onNodeDataChange(node.id, "model", modelName);
        setValue("model", modelName);
      }
    },
    [node.id, models, onNodeDataChange, setValue]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);
      onNodeDataChange(node.id, "input", value);
    },
    [node.id, onNodeDataChange]
  );

  const {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: handleInputChange,
    availableVariables,
  });

  const handleAddServer = () => {
    setEditingServer(undefined);
    onOpen();
  };

  const handleEditServer = (server: ServerConfig) => {
    setEditingServer(server);
    onOpen();
  };

  const handleSaveServer = async (serverData: ServerConfig) => {
    const newServers = editingServer
      ? servers.map((s) => (s.name === editingServer.name ? serverData : s))
      : [...servers, serverData];

    // 先更新服务器列表
    setServers(newServers);
    updateMCPConfig(newServers);

    // 立即获取新服务器的tools
    await fetchTools(serverData);
  };

  const handleDeleteServer = (server: ServerConfig) => {
    setDeletingServer(server);
    onDeleteOpen();
  };

  const confirmDelete = () => {
    if (deletingServer) {
      const newServers = servers.filter((s) => s.name !== deletingServer.name);
      setServers(newServers);
      updateMCPConfig(newServers);
      onDeleteClose();
      setDeletingServer(undefined);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
          {t("workflow.nodes.mcp.model")}:
        </Text>
        <ModelSelect<FormValues>
          models={models}
          control={control}
          name="model"
          onModelSelect={onModelSelect}
          isLoading={isLoadingModel}
          value={node.data.model}
        />
      </Box>

      <VariableSelector
        label={t("workflow.nodes.mcp.input")}
        value={inputText}
        onChange={handleInputChange}
        showVariables={showVariables}
        setShowVariables={setShowVariables}
        inputRef={inputRef}
        handleKeyDown={handleKeyDown}
        insertVariable={insertVariable}
        availableVariables={availableVariables}
        minHeight="100px"
        placeholder={t("workflow.nodes.mcp.inputPlaceholder")!}
      />

      <Box>
        <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
          {t("workflow.nodes.mcp.servers")}:
        </Text>
        <VStack spacing={4} align="stretch">
          {servers.length === 0 ? (
            <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
              {t("workflow.nodes.mcp.noServers")}
            </Text>
          ) : (
            servers.map((server, index) => (
              <ServerCard
                key={index}
                server={server}
                onEdit={() => handleEditServer(server)}
                onDelete={() => handleDeleteServer(server)}
                tools={server.tools || []}
                isLoadingTools={isLoadingTools[server.name] || false}
              />
            ))
          )}

          <Button
            leftIcon={<AddIcon />}
            onClick={handleAddServer}
            size="sm"
            variant="outline"
          >
            {t("workflow.nodes.mcp.addServer")}
          </Button>
        </VStack>
      </Box>

      <ServerModal
        isOpen={isOpen}
        onClose={onClose}
        onSave={handleSaveServer}
        initialData={editingServer}
      />

      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {t("workflow.nodes.mcp.modal.deleteConfirm")}
            </AlertDialogHeader>

            <AlertDialogBody>
              {t("workflow.nodes.mcp.modal.deleteMessage")}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                {t("workflow.nodes.mcp.modal.cancel")}
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                {t("workflow.nodes.mcp.modal.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
};

export default MCPNodeProperties;
