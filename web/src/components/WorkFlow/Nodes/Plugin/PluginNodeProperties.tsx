import {
    Text,
    VStack,
    FormControl,
    FormLabel,
    Spinner,
    Box,
    Tooltip,
    HStack,
    Button,
    useToast,
    Code,
    // --- Start: Added for Modal ---
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    // --- End: Added for Modal ---
} from "@chakra-ui/react";
import React, { useCallback, useMemo, useState, useEffect } from "react";

import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";
import type { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import type { ToolProviderWithToolsListOut } from "@/client";
import { ToolsService } from "@/client";

interface ParameterInputProps {
    paramName: string;
    paramDetails: any;
    value: string;
    onChange: (paramName: string, value: string) => void;
    availableVariables: VariableReference[];
}

const ParameterInput: React.FC<ParameterInputProps> = ({
    paramName,
    paramDetails,
    value,
    onChange,
    availableVariables
}) => {
    const hasLongDescription = paramDetails.description && paramDetails.description.length > 50;

    return (
        <FormControl key={paramName} isRequired={paramDetails.required}>
            <HStack justify="space-between" align="center" mb={1}>
                <FormLabel mb={0} fontWeight="medium" color="gray.800">
                    {paramName}
                    <Text as="span" fontSize="xs" color="gray.500" ml={2} fontWeight="normal">
                        ({paramDetails.type})
                    </Text>
                </FormLabel>
            </HStack>
            <Tooltip label={paramDetails.description} isDisabled={!hasLongDescription} placement="top-start" hasArrow>
                <VariableSelector
                    label={null}
                    value={value}
                    onChange={(newValue) => onChange(paramName, newValue)}
                    placeholder={hasLongDescription ? "" : paramDetails.description}
                    availableVariables={availableVariables}
                    minHeight="40px"
                    rows={1}
                />
            </Tooltip>
        </FormControl>
    );
};

// --- 主组件 ---
interface PluginNodePropertiesProps {
    node: any;
    onNodeDataChange: (nodeId: string, key: string, value: any) => void;
    availableVariables: VariableReference[];
}

const PluginNodeProperties: React.FC<PluginNodePropertiesProps> = ({
    node,
    onNodeDataChange,
    availableVariables,
}) => {
    const { data: toolProvidersData, isLoading } = useToolProvidersQuery();
    const [argValues, setArgValues] = useState<Record<string, any>>({});
    const toast = useToast();

    // --- Start: Modal states and controls ---
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [modalArgValues, setModalArgValues] = useState<Record<string, any>>({});
    const [isModalLoading, setIsModalLoading] = useState(false);
    const [modalResult, setModalResult] = useState<string | null>(null);
    // --- End: Modal states and controls ---

    const selectedTool = useMemo(() => {
        const providers: ToolProviderWithToolsListOut[] = toolProvidersData?.providers || [];
        if (!node.data.tool?.id) return null;
        for (const provider of providers) {
            const foundTool = provider.tools.find(t => t.id === node.data.tool.id);
            if (foundTool) return foundTool;
        }
        return null;
    }, [node.data.tool?.id, toolProvidersData]);
    
    // Sync state with node data from props
    useEffect(() => {
        try {
            const existingArgs = node.data.args ? JSON.parse(node.data.args) : {};
            setArgValues(existingArgs);
        } catch (e) {
            setArgValues({});
        }
    }, [node.data.args]);

    // Handles changes for the main node configuration inputs
    const handleArgChange = useCallback((paramName: string, value: string) => {
        const newArgValues = { ...argValues, [paramName]: value };
        setArgValues(newArgValues);
        onNodeDataChange(node.id, "args", JSON.stringify(newArgValues, null, 2));
    }, [argValues, node.id, onNodeDataChange]);

    // --- Start: Modal specific logic ---
    // Handles changes for the test modal inputs
    const handleModalArgChange = useCallback((paramName: string, value: string) => {
        setModalArgValues(prev => ({ ...prev, [paramName]: value }));
    }, []);
    
    const handleOpenModal = () => {
        setModalArgValues({}); // Clear previous test inputs
        setModalResult(null);   // Clear previous test result
        onOpen();
    };

    const handleRunTest = useCallback(async () => {
        if (!selectedTool) return;

        setIsModalLoading(true);
        setModalResult(null);

        try {
            const response = await ToolsService.invokeTools({
                toolId: selectedTool.id,
                toolName: selectedTool.display_name!,
                requestBody: modalArgValues,
            });
            setModalResult(JSON.stringify(response, null, 2));
            toast({
                title: "Test run successful.",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error: any) {
            const errorMessage = error.body?.detail || error.message || "An unknown error occurred.";
            setModalResult(`Error: ${errorMessage}\n\n${JSON.stringify(error.body, null, 2)}`);
            toast({
                title: "Error during test run.",
                description: errorMessage,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsModalLoading(false);
        }
    }, [selectedTool, modalArgValues, toast]);
    // --- End: Modal specific logic ---

    if (isLoading) {
        return <Box display="flex" justifyContent="center" p={4}><Spinner /></Box>;
    }

    if (!selectedTool?.input_parameters || Object.keys(selectedTool.input_parameters).length === 0) {
        return <Text p={2} fontSize="sm" color="gray.500">No input parameters for this tool.</Text>;
    }

    return (
        <VStack align="stretch" spacing={4} p={1}>
            {/* Main inputs for node configuration */}
            <VStack align="stretch" spacing={4}>
                <Text fontSize="sm" color="gray.600">Configure the parameters for the workflow execution.</Text>
                {Object.entries(selectedTool.input_parameters).map(([paramName, paramDetails]) => (
                    <ParameterInput
                        key={paramName}
                        paramName={paramName}
                        paramDetails={paramDetails}
                        value={argValues[paramName] || ""}
                        onChange={handleArgChange}
                        availableVariables={availableVariables}
                    />
                ))}
            </VStack>

            {/* Button to open the test modal */}
            <Box mt={4}>
                <Button w="100%" colorScheme="gray" variant="outline" onClick={handleOpenModal}>
                    Test Tool
                </Button>
            </Box>

            {/* Test Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Test Tool: {selectedTool.name}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        <VStack spacing={4} align="stretch">
                            <Text fontSize="sm" color="gray.600">
                                Enter parameters for an isolated test run. This will not affect the saved node configuration.
                            </Text>
                            {Object.entries(selectedTool.input_parameters).map(([paramName, paramDetails]) => (
                                <ParameterInput
                                    key={`modal-${paramName}`}
                                    paramName={paramName}
                                    paramDetails={paramDetails}
                                    value={modalArgValues[paramName] || ""}
                                    onChange={handleModalArgChange}
                                    availableVariables={[]} // No variables in isolated test
                                />
                            ))}
                            {modalResult && (
                                <Box pt={4} w="100%">
                                    <FormLabel>Test Output</FormLabel>
                                    <Code as="pre" p={3} w="100%" borderRadius="md" bg="gray.50" color="gray.800" overflowX="auto" fontSize="sm" maxHeight="300px">
                                        {modalResult}
                                    </Code>
                                </Box>
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={onClose}>
                            Close
                        </Button>
                        <Button
                            colorScheme="blue"
                            onClick={handleRunTest}
                            isLoading={isModalLoading}
                        >
                            Run Test
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </VStack>
    );
};

export default PluginNodeProperties;