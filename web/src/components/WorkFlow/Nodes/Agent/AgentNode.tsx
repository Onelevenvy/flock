import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import React, { useEffect, useState, useMemo } from "react";
import { Handle, type NodeProps, Position } from "reactflow";

import ModelProviderIcon from "@/components/Icons/models";
import ToolsIcon from "@/components/Icons/Tools";
import { GiArchiveResearch } from "react-icons/gi";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";

// 为工具数据定义清晰的类型
interface SavedTool {
    id: number;
    name: string;
    provider: string;
}

const AgentNode: React.FC<NodeProps> = (props) => {
    const { icon: Icon, colorScheme } = nodeConfig.agent;
    const [providerName, setProviderName] = useState<string>(props.data.model!);

    useEffect(() => {
        setProviderName(props.data.model!);
    }, [props.data]);

    const memoizedIcon = useMemo(
        () => (
            <ModelProviderIcon modelprovider_name={providerName} key={providerName} />
        ),
        [providerName],
    );

    const tools: SavedTool[] = Array.isArray(props.data.tools) ? props.data.tools : [];
    const retrievalTools = Array.isArray(props.data.retrievalTools)
        ? props.data.retrievalTools
        : [];

    const handleStyle = {
        background: "var(--chakra-colors-ui-wfhandlecolor)",
        width: 8,
        height: 8,
        border: "2px solid white",
        transition: "all 0.2s",
    };

    return (
        <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={handleStyle}
            />
            <Handle
                type="target"
                position={Position.Right}
                id="right"
                style={handleStyle}
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                style={handleStyle}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={handleStyle}
            />

            <VStack spacing={2} align="stretch">
                {/* 显示模型信息 */}
                <Box
                    bg="ui.inputbgcolor"
                    borderRadius="md"
                    w="full"
                    p="2"
                    display="flex"
                    flexDirection="row"
                    justifyContent="center"
                    alignItems="center"
                    transition="all 0.2s"
                    _hover={{
                        bg: "gray.100",
                    }}
                >
                    {memoizedIcon}
                    <Text fontSize="xs" ml={2} color="gray.700" fontWeight="500">
                        {props.data.model || "No model selected"}
                    </Text>
                </Box>

                {/* --- 核心修改区域: 显示工具信息 --- */}
                {tools.length > 0 && (
                    <VStack align="stretch" spacing={1}>
                        <Text fontSize="xs" fontWeight="500" color="gray.600" pl={1} textAlign="left">
                            Tools:
                        </Text>
                        {/* 使用新的对象结构来渲染 */}
                        {tools.map((tool: SavedTool) => (
                            <Box
                                key={tool.id} // 使用 tool.id 作为 key
                                bg="ui.inputbgcolor"
                                borderRadius="md"
                                p={1}
                                transition="all 0.2s"
                                _hover={{
                                    bg: "gray.100",
                                    transform: "translateY(-1px)",
                                    boxShadow: "sm",
                                }}
                            >
                                <HStack spacing={2} px={2}>
                                    {/* 从 tool.provider 获取图标名称 */}
                                    <ToolsIcon tools_name={tool.provider} />
                                    {/* 从 tool.name 显示工具名称 */}
                                    <Text fontSize="xs" fontWeight="500" color="gray.700">
                                        {tool.name}
                                    </Text>
                                </HStack>
                            </Box>
                        ))}
                    </VStack>
                )}

                {/* 显示知识库工具信息 */}
                {retrievalTools.length > 0 && (
                    <VStack align="stretch" spacing={1}>
                        <Text fontSize="xs" fontWeight="500" color="gray.600" pl={1}>
                            Knowledge Bases:
                        </Text>
                        {retrievalTools.map((kb: any, index: number) => {
                            const kbName = typeof kb === "string" ? kb : kb.name;

                            return (
                                <Box
                                    key={`kb-${index}`}
                                    bg="ui.inputbgcolor"
                                    borderRadius="md"
                                    p={1}
                                    transition="all 0.2s"
                                    _hover={{
                                        bg: "gray.100",
                                        transform: "translateY(-1px)",
                                        boxShadow: "sm",
                                    }}
                                >
                                    <HStack spacing={2} px={2}>
                                        <Box as={GiArchiveResearch} size="12px" color="blue.500" />
                                        <Text fontSize="xs" fontWeight="500" color="gray.700">
                                            {kbName}
                                        </Text>
                                    </HStack>
                                </Box>
                            );
                        })}
                    </VStack>
                )}
            </VStack>
        </BaseNode>
    );
};

export default React.memo(AgentNode, (prevProps, nextProps) => {
    // 这个比较函数对于对象数组依然有效
    return (
        prevProps.data.model === nextProps.data.model &&
        prevProps.data.label === nextProps.data.label &&
        JSON.stringify(prevProps.data.tools) ===
        JSON.stringify(nextProps.data.tools) &&
        JSON.stringify(prevProps.data.retrievalTools) ===
        JSON.stringify(nextProps.data.retrievalTools)
    );
});