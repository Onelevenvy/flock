import {
  Box,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  VStack,
  useStyleConfig,
  type ChakraProps,
} from "@chakra-ui/react";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { VariableReference } from "../FlowVis/variableSystem";

// --- 辅助函数 (保持不变) ---

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

// --- 组件 Props (保持不变) ---
interface VariableSelectorProps {
  label: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableVariables: VariableReference[];
  minHeight?: string;
  rows?: number;
}

export default function VariableSelector(props: VariableSelectorProps) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { label, value, onChange, placeholder, availableVariables, minHeight } = props;
  const styles = useStyleConfig("Textarea", {}) as ChakraProps;

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
      const spaceNode = document.createTextNode('\u00A0');

      range.deleteContents();
      range.insertNode(variableNode);
      range.setStartAfter(variableNode);
      range.collapse(true);
      range.insertNode(spaceNode);
      range.setStartAfter(spaceNode);
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
          {label && (<Text fontWeight="600" mb={2} color="gray.700" fontSize="sm">{label}</Text>)}
          <style>{`.variable-badge { background-color: #EBF8FF; color: #2C5282; font-weight: 500; border-radius: 6px; padding: 2px 8px; margin: 0 2px; display: inline-block; }`}</style>
          <Popover isOpen={isPopoverOpen} onClose={() => setIsPopoverOpen(false)} placement="bottom-start" autoFocus={false} >
              <PopoverTrigger>
              <span>
                  <Box 
                      ref={editorRef} 
                      contentEditable 
                      onInput={handleInput} 
                      onKeyDown={handleKeyDown} 
                      sx={{
                          ...styles, // 应用 Textarea 的基础样式
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
              <PopoverContent width="auto" minWidth="250px" maxWidth="400px" boxShadow="lg" border="1px solid" borderColor="gray.100" borderRadius="lg" p={2} bg="white" _focus={{ outline: "none" }}>
                  <VStack align="stretch" spacing={1}>
                      <Text fontSize="sm" fontWeight="600" color="gray.600" p={2} borderBottom="1px solid" borderColor="gray.100">{t("workflow.variableSelector.availableVariables")}</Text>
                      {availableVariables?.length > 0 ? (
                          availableVariables.map((v) => (
                              <Button key={`${v.nodeId}.${v.variableName}`} onClick={() => handleInsertVariable(`${v.nodeId}.${v.variableName}`)} size="sm" variant="ghost" justifyContent="flex-start" px={3} py={2} height="auto" transition="all 0.2s" _hover={{ bg: "blue.50", transform: "translateX(2px)" }}
                                  leftIcon={<Box as="span" bg="blue.50" color="blue.600" px={2} py={1} borderRadius="md" fontSize="xs" fontWeight="600">{v.nodeId}</Box>}>
                                  <Text fontSize="sm" ml={2} color="gray.700">{v.variableName}</Text>
                              </Button>
                          ))
                      ) : (<Text fontSize="sm" color="gray.500" textAlign="center" p={4}>{t("workflow.variableSelector.noVariables")}</Text>)}
                  </VStack>
              </PopoverContent>
          </Popover>
      </Box>
  );
}