import { useState, useRef, useCallback } from "react";

import { VariableReference } from "../../components/WorkFlow/FlowVis/variableSystem";

interface UseVariableInsertionProps<
  T extends HTMLInputElement | HTMLTextAreaElement,
> {
  onValueChange: (value: string) => void;
  availableVariables: VariableReference[];
}

export const useVariableInsertion = <
  T extends HTMLInputElement | HTMLTextAreaElement,
>({
  onValueChange,
  availableVariables,
}: UseVariableInsertionProps<T>) => {
  const [showVariables, setShowVariables] = useState(false);
  const inputRef = useRef<T>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "/") {
      e.preventDefault();
      setShowVariables(true);
    }
  }, []);

  const insertVariable = useCallback(
    (variable: string) => {
      const input = inputRef.current;

      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const text = input.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newValue = before + `{${variable}}` + after;

        onValueChange(newValue);
        setShowVariables(false);
        input.focus();
        input.setSelectionRange(
          start + variable.length + 2,
          start + variable.length + 2
        );
      }
    },
    [onValueChange]
  );

  return {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  };
};
