import { Box, Text, VStack, useToast, Button, useDisclosure, HStack, IconButton, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Badge } from "@chakra-ui/react";
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

interface ServerConfig {
  name: string;
  transport: 'stdio' | 'sse';
  command?: 'python' | 'node';
  args?: string[];
  url?: string;
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

const formatScriptPath = (path: string) => {
  const parts = path.split('/');
  if (parts.length <= 3) return path;
  
  return '.../' + parts.slice(-3).join('/');
};

const ServerCard: React.FC<{
  server: ServerConfig;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ server, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const transportType = server.transport === "stdio" ? t("workflow.nodes.mcp.serverType.stdio") : t("workflow.nodes.mcp.serverType.sse");

  const getServerDetails = () => {
    if (server.transport === "stdio") {
      const scriptPath = server.args?.[0] || "";
      const formattedPath = formatScriptPath(scriptPath);
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
              {t("workflow.nodes.mcp.scriptPath")}:
            </Text>
            <VStack spacing={1} align="stretch">
              <Text fontSize="xs" fontWeight="500">
                {server.command}
              </Text>
              <Text fontSize="xs" color="gray.600" isTruncated title={scriptPath}>
                {formattedPath}
              </Text>
            </VStack>
          </HStack>
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
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>();
  const [deletingServer, setDeletingServer] = useState<ServerConfig | undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { control, setValue } = useForm<FormValues>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      model: node.data.model || "",
      provider: node.data.provider || "",
    },
  });

  const { data: models, isLoading: isLoadingModel } = useModelQuery();

  useEffect(() => {
    if (node && node.data.input !== undefined) {
      setInputText(node.data.input);
    }
    if (node && node.data.model) {
      setValue("model", node.data.model);
    }
    if (node && node.data.mcp_config) {
      const serverConfigs: ServerConfig[] = Object.entries(node.data.mcp_config).map(
        ([name, config]: [string, any]) => ({
          name,
          transport: config.transport,
          ...(config.transport === 'stdio' ? {
            command: config.command,
            args: config.args,
          } : {
            url: config.url,
          }),
        })
      );
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

  const updateMCPConfig = useCallback((newServers: ServerConfig[]) => {
    const mcp_config = newServers.reduce((acc, server) => {
      if (!server.name) return acc;
      
      if (server.transport === 'stdio') {
        acc[server.name] = {
          command: server.command || 'python',
          args: server.args || [],
          transport: 'stdio'
        };
      } else {
        acc[server.name] = {
          url: server.url || '',
          transport: 'sse'
        };
      }
      return acc;
    }, {} as Record<string, any>);

    onNodeDataChange(node.id, "mcp_config", mcp_config);
  }, [node.id, onNodeDataChange]);

  const handleAddServer = () => {
    setEditingServer(undefined);
    onOpen();
  };

  const handleEditServer = (server: ServerConfig) => {
    setEditingServer(server);
    onOpen();
  };

  const handleSaveServer = (serverData: ServerConfig) => {
    const newServers = editingServer
      ? servers.map((s) => (s.name === editingServer.name ? serverData : s))
      : [...servers, serverData];
    setServers(newServers);
    updateMCPConfig(newServers);
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