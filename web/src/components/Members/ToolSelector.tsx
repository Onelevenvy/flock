import { ToolOutIdWithAndName } from '@/client/models/ToolOutIdWithAndName';
import { ToolProviderWithToolsListOut } from '@/client/models/ToolProviderWithToolsListOut';
import { Search, Plus } from 'lucide-react';
import { useState } from 'react';
import ToolsIcon from "@/components/Icons/Tools/index";
import { useTranslation } from 'react-i18next';
import {
    Button,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Input,
    Accordion,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    AccordionIcon,
    Tooltip,
    Box,
    Text,
    VStack,
    HStack,
    Divider,
} from "@chakra-ui/react";

interface ToolSelectorProps {
    providers: ToolProviderWithToolsListOut[];
    selectedTools: ToolOutIdWithAndName[];
    onSelect: (tool: ToolOutIdWithAndName) => void;
    onDeselect: (tool: ToolOutIdWithAndName) => void;
    onBatchChange?: (tools: ToolOutIdWithAndName[], selected: boolean) => void;
    children?: React.ReactNode;
}

export default function ToolSelector({
    providers,
    selectedTools,
    onSelect,
    onDeselect,
    onBatchChange,
    children,
}: ToolSelectorProps) {
    const { t } = useTranslation();
    const [searchText, setSearchText] = useState('');
    const [open, setOpen] = useState(false);
    const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(
        null,
    );

    // 过滤工具
    const filteredProviders = providers
        .map((provider) => ({
            ...provider,
            tools: provider.tools.filter((tool) => {
                const matchSearch =
                    (tool.display_name || tool.name)
                        .toLowerCase()
                        .includes(searchText.toLowerCase()) ||
                    tool.description.toLowerCase().includes(searchText.toLowerCase()) ||
                    provider.provider_name
                        .toLowerCase()
                        .includes(searchText.toLowerCase());
                return matchSearch;
            }),
        }))
        .filter((provider) => provider.tools.length > 0);

    // 处理对话框的打开和关闭
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
    };

    // 处理工具选择
    const handleToolToggle = (
        tool: ToolOutIdWithAndName,
        event: React.MouseEvent,
    ) => {
        // 阻止事件冒泡
        event.stopPropagation();

        // 检查工具是否已被选中
        const isSelected = selectedTools.some(
            (selected) => selected.id === tool.id,
        );

        // 根据当前状态切换选择/取消选择
        if (isSelected) {
            onDeselect(tool);
        } else {
            onSelect(tool);
        }
    };

    // 检查工具是否已被选中
    const isToolSelected = (toolId: number) => {
        return selectedTools.some((tool) => tool.id === toolId);
    };

    // 获取提供商下已选择的工具数量
    const getSelectedToolsCount = (providerTools: ToolOutIdWithAndName[]) => {
        return providerTools.filter((tool) => isToolSelected(tool.id)).length;
    };

    // 处理添加全部工具
    const handleAddAllTools = (
        providerTools: ToolOutIdWithAndName[],
        event: React.MouseEvent,
    ) => {
        // 阻止事件冒泡
        event.stopPropagation();

        // 获取未选择的工具
        const unselectedTools = providerTools.filter(
            (tool) => !isToolSelected(tool.id),
        );
        const allSelected = unselectedTools.length === 0;

        // 如果提供了批量处理函数，则使用它
        if (onBatchChange) {
            if (allSelected) {
                // 如果所有工具都已选择，则取消选择所有工具
                onBatchChange(providerTools, false);
            } else {
                // 否则选择所有未选择的工具
                onBatchChange(unselectedTools, true);
            }
        } else {
            // 如果没有提供批量处理函数，则逐个处理
            if (allSelected) {
                // 如果所有工具都已选择，则取消选择所有工具
                providerTools.forEach((tool) => {
                    onDeselect(tool);
                });
            } else {
                // 否则选择所有未选择的工具
                unselectedTools.forEach((tool) => {
                    onSelect(tool);
                });
            }
        }
    };

    // 如果提供了children，则使用children作为触发器
    // 否则使用默认的按钮作为触发器
    const trigger = children ? (
        <Box onClick={() => setOpen(true)} style={{ display: 'inline-block' }}>
            {children}
        </Box>
    ) : (
        <Button 
            onClick={() => setOpen(true)}
            leftIcon={<Plus size={16} />}
            size="sm"
            variant="outline"
            aria-label="Add tools"
        />
    );

    return (
        <Box>
            {trigger}
            <Modal isOpen={open} onClose={() => setOpen(false)} size="xl">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Add tools</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        <Box position="relative" mb={4}>
                            <Search style={{ position: 'absolute', left: '8px', top: '10px' }} size={16} />
                            <Input
                                placeholder="Search tools"
                                pl="40px"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </Box>
                        <Box maxHeight="400px" overflowY="auto">
                            <Accordion allowMultiple>
                                {filteredProviders.map((provider, index) => {
                                    const providerId = `${provider.id}-${index}`;
                                    const selectedCount = getSelectedToolsCount(provider.tools);
                                    const totalCount = provider.tools.length;
                                    const allSelected = selectedCount === totalCount;
                                    const isHovered = hoveredProviderId === providerId;

                                    return (
                                        <AccordionItem key={provider.id} border="none">
                                            <AccordionButton
                                                py={2}
                                                _hover={{ bg: 'gray.50' }}
                                                onMouseEnter={() => setHoveredProviderId(providerId)}
                                                onMouseLeave={() => setHoveredProviderId(null)}
                                            >
                                                <Box flex="1" textAlign="left">
                                                    <HStack>
                                                        {provider.icon && (
                                                            <Box w="5" h="5" borderRadius="md" bg="primary.100" display="flex" alignItems="center" justifyContent="center">
                                                                <ToolsIcon
                                                                    h="6"
                                                                    w="6"
                                                                    tools_name={(provider.provider_name!)
                                                                    }
                                                                    color={`${provider.tool_type === 'builtin' ? "blue" : "purple"}.500`}
                                                                />
                                                            </Box>
                                                        )}
                                                        <Text>
                                                            {provider.display_name || provider.provider_name}
                                                        </Text>
                                                    </HStack>
                                                </Box>
                                                {(isHovered || selectedCount > 0) && (
                                                    <Button
                                                        size="xs"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAddAllTools(provider.tools, e as any);
                                                        }}
                                                    >
                                                        {allSelected && totalCount > 0
                                                            ? '已全部添加'
                                                            : selectedCount > 0
                                                                ? `${selectedCount}/${totalCount}`
                                                                : '添加全部'}
                                                    </Button>
                                                )}
                                                <AccordionIcon />
                                            </AccordionButton>
                                            <AccordionPanel pb={2}>
                                                {provider.tools.map((tool) => {
                                                    const selected = isToolSelected(tool.id);
                                                    return (
                                                        <Tooltip
                                                            key={tool.id}
                                                            label={tool.description}
                                                            placement="right"
                                                            isDisabled={!tool.description}
                                                        >
                                                            <Box
                                                                p={2}
                                                                borderRadius="md"
                                                                cursor="pointer"
                                                                _hover={{ bg: 'gray.50' }}
                                                                onClick={(event) => handleToolToggle(tool, event as any)}
                                                            >
                                                                <HStack justify="space-between">
                                                                    <Text
                                                                        fontSize="sm"
                                                                        color={selected ? 'gray.500' : 'inherit'}
                                                                    >
                                                                        {tool.display_name || tool.name}
                                                                    </Text>
                                                                    {selected && (
                                                                        <Text fontSize="xs" color="gray.500">
                                                                            已添加
                                                                        </Text>
                                                                    )}
                                                                </HStack>
                                                            </Box>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </AccordionPanel>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                            {filteredProviders.length === 0 && (
                                <Text textAlign="center" color="gray.500" py={4}>
                                    {searchText
                                        ? t('build.noMatchingTools') || 'No matching tools'
                                        : t('build.noAvailableTools') || 'No available tools'}
                                </Text>
                            )}
                        </Box>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Box>
    );
}
