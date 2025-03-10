import { Box, Text, VStack, Input, Select, Button, useToast } from "@chakra-ui/react";
import React, { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";

import ModelSelect from "@/components/Common/ModelProvider";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useModelQuery } from "@/hooks/useModelQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import { useForm } from "react-hook-form";

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

const MCPNodeProperties: React.FC<MCPNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [inputText, setInputText] = useState("");

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

  const addServer = useCallback(() => {
    const newServers = [...servers, { name: '', transport: 'stdio' as const }];
    setServers(newServers);
    updateMCPConfig(newServers);
  }, [servers, updateMCPConfig]);

  const removeServer = useCallback((index: number) => {
    const newServers = servers.filter((_, i) => i !== index);
    setServers(newServers);
    updateMCPConfig(newServers);
  }, [servers, updateMCPConfig]);

  const updateServer = useCallback((index: number, updates: Partial<ServerConfig>) => {
    const newServers = [...servers];
    newServers[index] = { ...newServers[index], ...updates };
    setServers(newServers);
    updateMCPConfig(newServers);
  }, [servers, updateMCPConfig]);

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
          {servers.map((server, index) => (
            <Box
              key={index}
              p={4}
              borderWidth={1}
              borderRadius="md"
              borderColor="gray.200"
            >
              <VStack spacing={3} align="stretch">
                <Input
                  placeholder={t("workflow.nodes.mcp.serverName")!}
                  value={server.name}
                  onChange={(e) => updateServer(index, { name: e.target.value })}
                  size="sm"
                />

                <Select
                  value={server.transport}
                  onChange={(e) => updateServer(index, { transport: e.target.value as 'stdio' | 'sse' })}
                  size="sm"
                >
                  <option value="stdio">Stdio</option>
                  <option value="sse">SSE</option>
                </Select>

                {server.transport === 'stdio' && (
                  <>
                    <Select
                      value={server.command}
                      onChange={(e) => updateServer(index, { command: e.target.value as 'python' | 'node' })}
                      size="sm"
                    >
                      <option value="python">Python</option>
                      <option value="node" disabled>Node.js (Not supported yet)</option>
                    </Select>

                    <Input
                      placeholder={t("workflow.nodes.mcp.scriptPath")!}
                      value={server.args?.[0] || ''}
                      onChange={(e) => updateServer(index, { args: [e.target.value] })}
                      size="sm"
                    />
                  </>
                )}

                {server.transport === 'sse' && (
                  <Input
                    placeholder={t("workflow.nodes.mcp.sseUrl")!}
                    value={server.url || ''}
                    onChange={(e) => updateServer(index, { url: e.target.value })}
                    size="sm"
                  />
                )}

                <Button
                  leftIcon={<DeleteIcon />}
                  colorScheme="red"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeServer(index)}
                >
                  {t("workflow.nodes.mcp.removeServer")}
                </Button>
              </VStack>
            </Box>
          ))}

          <Button
            leftIcon={<AddIcon />}
            onClick={addServer}
            size="sm"
            variant="outline"
          >
            {t("workflow.nodes.mcp.addServer")}
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
};

export default MCPNodeProperties; 