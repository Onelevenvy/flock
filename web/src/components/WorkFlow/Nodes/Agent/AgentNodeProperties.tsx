import { DeleteIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    HStack,
    IconButton,
    Text,
    VStack,
    Divider,
} from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaTools, FaRobot } from "react-icons/fa";
import { GiArchiveResearch } from "react-icons/gi";

import ModelSelect from "@/components/Common/ModelProvider";
import ToolsIcon from "@/components/Icons/Tools";

import { useModelQuery } from "@/hooks/useModelQuery";
import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";
import { useUploadsQuery } from "@/hooks/useUploadsQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import { useForm } from "react-hook-form";
import KBListModal from "../RetrievalTool/KBListModal";

import ToolSelector from "@/components/Members/ToolSelector";
import { ToolOutIdWithAndName } from "@/client";

// 为保存的工具对象定义清晰的类型
interface SavedTool {
    id: number;
    name: string;
    provider: string;
}

interface FormValues {
    model: string;
    provider: string;
}

interface KBInfo {
    name: string;
    description: string;
    usr_id: number;
    kb_id: number;
}

interface AgentNodePropertiesProps {
    node: any;
    onNodeDataChange: (nodeId: string, key: string, value: any) => void;
    availableVariables: VariableReference[];
}

const AgentNodeProperties: React.FC<AgentNodePropertiesProps> = ({
    node,
    onNodeDataChange,
    availableVariables,
}) => {
    const { t } = useTranslation();

    const [isToolsListOpen, setIsToolsListOpen] = useState(false);
    const [isKBListOpen, setIsKBListOpen] = useState(false);
    const [temperatureInput, setTemperatureInput] = useState("");
    const [systemPromptInput, setSystemPromptInput] = useState("");
    const [userPromptInput, setUserPromptInput] = useState("");

    const { control, setValue } = useForm<FormValues>({
        mode: "onBlur",
        criteriaMode: "all",
        defaultValues: {
            model: node.data.model || "",
            provider: node.data.provider || "",
        },
    });

    const { data: models, isLoading: isLoadingModel } = useModelQuery();
    const { data: toolProvidersData, isLoading: isLoadingSkills } = useToolProvidersQuery();
    const { data: uploads, isLoading: isLoadingKB } = useUploadsQuery();

  
    const providers = useMemo(
        () => toolProvidersData?.providers || [], 
        [toolProvidersData]
    );

    useEffect(() => {
        if (node && node.data.temperature !== undefined) {
            setTemperatureInput(node.data.temperature.toString());
        }
        if (node && node.data.systemMessage !== undefined) {
            setSystemPromptInput(node.data.systemMessage || "");
        }
        if (node && node.data.userMessage !== undefined) {
            setUserPromptInput(node.data.userMessage || "");
        }
        if (node && node.data.model) {
            setValue("model", node.data.model);
        }
        if (node && node.data.provider) {
            setValue("provider", node.data.provider);
        }
    }, [node, setValue]);

    const onModelSelect = useCallback(
        (modelName: string) => {
            const selectedModel = models?.data.find(
                (model) => model.ai_model_name === modelName,
            );
            if (selectedModel) {
                const providerName = selectedModel.provider.provider_name || "";
                onNodeDataChange(node.id, "model", modelName);
                onNodeDataChange(node.id, "provider", providerName);
                setValue("model", modelName);
                setValue("provider", providerName);
            }
        },
        [node.id, models, onNodeDataChange, setValue],
    );

    const handleSystemPromptChange = useCallback(
        (value: string) => {
            setSystemPromptInput(value);
            onNodeDataChange(node.id, "systemMessage", value);
        },
        [node.id, onNodeDataChange],
    );
    const handleUserPromptChange = useCallback(
        (value: string) => {
            setUserPromptInput(value);
            onNodeDataChange(node.id, "userMessage", value);
        },
        [node.id, onNodeDataChange],
    );


    const handleSelectTool = useCallback((tool: ToolOutIdWithAndName) => {
        const currentTools: SavedTool[] = node.data.tools || [];
        if (!currentTools.some((t) => t.id === tool.id)) {
            const provider = providers.find(p => p.tools.some(t => t.id === tool.id));
            const newTool: SavedTool = {
                id: tool.id,
                name: tool.display_name || tool.name,
                provider: provider?.provider_name || "Unknown",
            };
            onNodeDataChange(node.id, "tools", [...currentTools, newTool]);
        }
    }, [node.id, node.data.tools, onNodeDataChange, providers]);

    const handleDeselectTool = useCallback((tool: ToolOutIdWithAndName) => {
        const currentTools: SavedTool[] = node.data.tools || [];
        onNodeDataChange(
            node.id,
            "tools",
            currentTools.filter((t) => t.id !== tool.id)
        );
    }, [node.id, node.data.tools, onNodeDataChange]);

    const handleBatchToolChange = useCallback((tools: ToolOutIdWithAndName[], selected: boolean) => {
        const currentToolsById = new Map((node.data.tools || []).map((t: SavedTool) => [t.id, t]));
        tools.forEach(tool => {
            if (selected) {
                if (!currentToolsById.has(tool.id)) {
                    const provider = providers.find(p => p.tools.some(t => t.id === tool.id));
                    const newTool: SavedTool = { id: tool.id, name: tool.display_name || tool.name, provider: provider?.provider_name || "Unknown" };
                    currentToolsById.set(tool.id, newTool);
                }
            } else {
                currentToolsById.delete(tool.id);
            }
        });
        onNodeDataChange(node.id, "tools", Array.from(currentToolsById.values()));
    }, [node.id, node.data.tools, onNodeDataChange, providers]);

    const removeTool = (toolId: number) => {
        const currentTools: SavedTool[] = node.data.tools || [];
        onNodeDataChange(
            node.id,
            "tools",
            currentTools.filter((t) => t.id !== toolId)
        );
    };

    const currentlySelectedTools = useMemo(() => {
        const allTools = providers.flatMap(p => p.tools || []);
        const selectedIds = new Set((node.data.tools || []).map((t: SavedTool) => t.id));
        return allTools.filter(tool => selectedIds.has(tool.id));
    }, [node.data.tools, providers]);

    // --- 知识库管理 (无变化) ---
    const addKB = (kb: KBInfo) => {
        const currentKBs = node.data.retrievalTools || [];
        if (!currentKBs.some((k: string | KBInfo) => (typeof k === "string" ? k : k.name) === kb.name)) {
            onNodeDataChange(node.id, "retrievalTools", [...currentKBs, kb]);
        }
    };
    const removeKB = (kbName: string) => {
        const currentKBs = node.data.retrievalTools || [];
        onNodeDataChange(
            node.id,
            "retrievalTools",
            currentKBs.filter((k: string | KBInfo) => (typeof k === "string" ? k : k.name) !== kbName),
        );
    };

    if (isLoadingModel || isLoadingSkills || isLoadingKB) {
        return <Text>Loading resources...</Text>;
    }

    return (
        <VStack align="stretch" spacing={4} mt={2}>
            {/* 模型设置部分 */}
            <Box>
                <HStack spacing={2} mb={2}>
                    <FaRobot size="16px" color="var(--chakra-colors-gray-600)" />
                    <Text fontWeight="600" fontSize="sm" color="gray.700">
                        {t("workflow.nodes.llm.model")}
                    </Text>
                </HStack>
                <ModelSelect<FormValues>
                    models={models}
                    control={control}
                    name="model"
                    onModelSelect={onModelSelect}
                    isLoading={isLoadingModel}
                    value={node.data.model}
                />
            </Box>

            <Box>
                <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
                    {t("workflow.nodes.llm.temperature")}:
                </Text>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperatureInput}
                    onChange={(e) => {
                        setTemperatureInput(e.target.value);
                        const numValue = Number.parseFloat(e.target.value);
                        onNodeDataChange(node.id, "temperature", numValue);
                    }}
                    style={{ width: "100%" }}
                />
                <Text fontSize="xs" textAlign="right">{temperatureInput || "0"}</Text>
            </Box>

            <Divider />

            {/* 提示词设置部分 */}
            <VariableSelector
                label="System Prompt"
                value={systemPromptInput}
                onChange={handleSystemPromptChange}
                availableVariables={availableVariables}
                minHeight="100px"
                placeholder="Enter system instructions for the agent..."
            />
            <VariableSelector
                label="User Prompt"
                required={true}
                value={userPromptInput}
                onChange={handleUserPromptChange}
                availableVariables={availableVariables}
                minHeight="100px"
                placeholder="Enter user instructions or template..."
            />

            <Divider />

            {/* --- 核心修改区域: 工具UI渲染 --- */}
            <Box>
                <HStack justify="space-between" align="center" mb={3}>
                    <HStack spacing={2}>
                        <FaTools size="14px" color="var(--chakra-colors-gray-600)" />
                        <Text fontSize="sm" fontWeight="500" color="gray.700">
                            {t("workflow.nodes.tool.title")}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                            ({node.data.tools?.length || 0})
                        </Text>
                    </HStack>
                    <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<FaTools size="12px" />}
                        onClick={() => setIsToolsListOpen(true)}
                        colorScheme="blue"
                    >
                        {t("workflow.nodes.tool.addTool")}
                    </Button>
                </HStack>

                <VStack align="stretch" spacing={2}>
                    {(node.data.tools || []).map((tool: SavedTool) => (
                        <Box
                            key={tool.id}
                            p={2}
                            bg="ui.inputbgcolor"
                            borderRadius="md"
                            borderLeft="3px solid"
                            borderLeftColor="blue.400"
                        >
                            <HStack justify="space-between" align="center">
                                <HStack spacing={2}>
                                    <ToolsIcon tools_name={tool.provider} />
                                    <Text fontSize="sm" fontWeight="500" color="gray.700">
                                        {tool.name}
                                    </Text>
                                </HStack>
                                <IconButton
                                    aria-label="Remove tool"
                                    icon={<DeleteIcon />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={() => removeTool(tool.id)}
                                />
                            </HStack>
                        </Box>
                    ))}
                </VStack>
            </Box>

            {isToolsListOpen && (
                <ToolSelector
                    isOpen={isToolsListOpen}
                    onClose={() => setIsToolsListOpen(false)}
                    providers={providers}
                    selectedTools={currentlySelectedTools}
                    onSelect={handleSelectTool}
                    onDeselect={handleDeselectTool}
                    onBatchChange={handleBatchToolChange}
                />
            )}

            <Divider />

            {/* 知识库设置部分 */}
            <Box>
                <HStack justify="space-between" align="center" mb={3}>
                    <HStack spacing={2}>
                        <GiArchiveResearch size="14px" color="var(--chakra-colors-gray-600)" />
                        <Text fontSize="sm" fontWeight="500" color="gray.700">
                            {t("workflow.nodes.retrieval.title")}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                            ({node.data.retrievalTools?.length || 0})
                        </Text>
                    </HStack>
                    <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<GiArchiveResearch size="12px" />}
                        onClick={() => setIsKBListOpen(true)}
                        colorScheme="blue"
                    >
                        {t("workflow.nodes.retrieval.addKB")}
                    </Button>
                </HStack>
                <VStack align="stretch" spacing={2}>
                    {(node.data.retrievalTools || []).map((kb: string | KBInfo) => {
                        const kbName = typeof kb === "string" ? kb : kb.name;
                        return (
                            <Box key={kbName} p={2} bg="ui.inputbgcolor" borderRadius="md" borderLeft="3px solid" borderLeftColor="blue.400">
                                <HStack justify="space-between" align="center">
                                    <HStack spacing={2}>
                                        <IconButton aria-label="db" icon={<GiArchiveResearch size="16px" />} colorScheme="blue" size="xs" variant="ghost" />
                                        <Text fontSize="sm" fontWeight="500" color="gray.700">{kbName}</Text>
                                    </HStack>
                                    <IconButton
                                        aria-label={t("workflow.nodes.retrieval.removeKB")}
                                        icon={<DeleteIcon />}
                                        size="xs"
                                        variant="ghost"
                                        colorScheme="red"
                                        onClick={() => removeKB(kbName)}
                                    />
                                </HStack>
                            </Box>
                        );
                    })}
                </VStack>
            </Box>

            {isKBListOpen && (
                <KBListModal
                    uploads={uploads?.data || []}
                    onClose={() => setIsKBListOpen(false)}
                    onAddKB={addKB}
                    selectedKBs={node.data.retrievalTools?.map((kb: string | KBInfo) => typeof kb === "string" ? kb : kb.name) || []}
                />
            )}
        </VStack>
    );
};

export default AgentNodeProperties;