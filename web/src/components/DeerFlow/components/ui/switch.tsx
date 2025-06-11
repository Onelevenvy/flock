"use client";

import * as React from "react";
import {
  Switch as ChakraSwitch,
  SwitchProps as ChakraSwitchProps,
} from "@chakra-ui/react";

export interface SwitchProps extends Omit<ChakraSwitchProps, "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
  checked?: boolean;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ onCheckedChange, checked, ...props }, ref) => {
    return (
      <ChakraSwitch
        ref={ref}
        size="md"
        colorScheme="blue"
        isChecked={checked}
        onChange={
          onCheckedChange ? (e) => onCheckedChange(e.target.checked) : undefined
        }
        {...props}
      />
    );
  },
);

Switch.displayName = "Switch";

export { Switch };
