import {
    Box,
    Button,
    HStack,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Text,
    VStack,
    useStyleConfig,
    type ChakraProps,
} from "@chakra-ui/react";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { VariableReference } from "../FlowVis/variableSystem";


function parseValueToHTML(value: string): string {
    const regex = /\${(.*?)}/g;
    const encodedValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return encodedValue.replace(regex, (match, variableName) => {
        return `<span class="variable-badge" contentEditable="false">${match}</span>`;
    });
}

function parseHTMLToValue(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return tempDiv.textContent || "";
}


interface VariableSelectorProps {
    label: React.ReactNode;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    availableVariables: VariableReference[];
    minHeight?: string;
    rows?: number;
    required?: boolean
}

export default function VariableSelector(props: VariableSelectorProps) {
    
    const { t } = useTranslation();
    const editorRef = useRef<HTMLDivElement>(null);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const { label, value, onChange, placeholder, availableVariables, minHeight,required } = props;
    const styles = useStyleConfig("Textarea", {}) as ChakraProps;

    const groupedVariables = useMemo(() => {
        return availableVariables.reduce((acc, v) => {
            (acc[v.nodeId] = acc[v.nodeId] || []).push(v);
            return acc;
        }, {} as Record<string, VariableReference[]>);
    }, [availableVariables]);


    useEffect(() => {
        if (editorRef.current && parseHTMLToValue(editorRef.current.innerHTML) !== value) {
            editorRef.current.innerHTML = parseValueToHTML(value);
        }
    }, [value]);

    const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
        const plainText = parseHTMLToValue(event.currentTarget.innerHTML);
        if (plainText.trim() === "") {
            onChange("");
        } else {
            onChange(plainText);
        }
    };
    
    const handleInsertVariable = (variableName: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        let range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) {
            range.selectNodeContents(editor);
            range.collapse(false);
        }

        const variableNode = document.createElement('span');
        variableNode.className = 'variable-badge';
        variableNode.setAttribute('contentEditable', 'false');
        variableNode.innerText = `\${${variableName}}`;

        range.deleteContents();
        range.insertNode(variableNode);
        
        // 将光标移动到新插入的 "badge" 之后
        range.setStartAfter(variableNode);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
        
        onChange(parseHTMLToValue(editor.innerHTML));
        setIsPopoverOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === '{' && e.shiftKey) {
            e.preventDefault();
            setIsPopoverOpen(true);
        }
    };

    return (
        <Box>
             {label && (
                <HStack as="label" spacing={1} mb={2} alignItems="center">
                    <Text fontWeight="600" color="gray.700" fontSize="sm">
                        {label}
                    </Text>
                    {required && (
                        <Text color="red.500" fontWeight="bold" as="span">
                            *
                        </Text>
                    )}
                </HStack>
            )}
            <style>{`.variable-badge { background-color: #EBF8FF; color: #2C5282; font-weight: 500; border-radius: 6px; padding: 2px 8px; margin: 0 2px; display: inline-block; font-size: 0.8em; }`}</style>
            <Popover isOpen={isPopoverOpen} onClose={() => setIsPopoverOpen(false)} placement="bottom-start" autoFocus={false} >
                <PopoverTrigger>
                    <span>
                        <Box 
                            ref={editorRef} 
                            contentEditable 
                            onInput={handleInput} 
                            onKeyDown={handleKeyDown} 
                            sx={{
                                ...styles,
                                py: 2,
                                px: 4,
                                minHeight: minHeight,
                                overflowY: "auto",
                                '&:empty:before': { 
                                    content: `"${placeholder || ''}"`, 
                                    color: 'gray.400', 
                                    cursor: 'text' 
                                }
                            }}
                        />
                    </span>
                </PopoverTrigger>
                <PopoverContent width="auto" minWidth="280px" maxWidth="400px" boxShadow="lg" border="1px solid" borderColor="gray.100" borderRadius="lg" p={2} bg="white" _focus={{ outline: "none" }}>
                    <VStack align="stretch" spacing={2} maxH="300px" overflowY="auto">
                        <Text fontSize="sm" fontWeight="600" color="gray.600" p={2} pb={1}>
                            {t("workflow.variableSelector.availableVariables")}
                        </Text>
                        {availableVariables?.length > 0 ? (
                            Object.entries(groupedVariables).map(([nodeId, vars]) => (
                                <Box key={nodeId} px={2}>
                                
                                    <Text
                                        fontSize="xs"
                                        fontWeight="bold"
                                        color="gray.400"
                                        casing="uppercase"
                                        mb={1}
                                    >
                                        {nodeId}
                                    </Text>
                            
                                    <VStack align="stretch" spacing={1}>
                                    {vars.map((v) => (
                                        <Button 
                                            key={`${v.nodeId}.${v.variableName}`} 
                                            onClick={() => handleInsertVariable(`${v.nodeId}.${v.variableName}`)} 
                                            size="sm" 
                                            variant="ghost" 
                                            justifyContent="space-between"
                                            px={3} py={2} height="auto" 
                                            transition="all 0.2s" 
                                            _hover={{ bg: "blue.50", transform: "translateX(2px)" }}
                                        >
                                            <Text fontSize="sm" color="gray.700" fontWeight="normal">
                                                {v.variableName}
                                            </Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="normal">
                                                {v.variableType}
                                            </Text>
                                        </Button>
                                    ))}
                                    </VStack>
                                </Box>
                            ))
                        ) : (
                            <Text fontSize="sm" color="gray.500" textAlign="center" p={4}>
                                {t("workflow.variableSelector.noVariables")}
                            </Text>
                        )}
                    </VStack>
                </PopoverContent>
            </Popover>
        </Box>
    );
}