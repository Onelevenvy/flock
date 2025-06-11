import * as React from "react";
import {
  Button as ChakraButton,
  ButtonProps as ChakraButtonProps,
} from "@chakra-ui/react";

export interface ButtonProps extends ChakraButtonProps {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const variantMapping = {
  default: "primary",
  destructive: "danger",
  outline: "outline",
  secondary: "secondary",
  ghost: "ghost",
  link: "link",
};

const sizeMapping = {
  default: "md",
  sm: "sm",
  lg: "lg",
  icon: "icon",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const chakraVariant = variantMapping[variant];
    const chakraSize = sizeMapping[size];

    return (
      <ChakraButton
        ref={ref}
        variant={chakraVariant}
        size={chakraSize}
        className={className}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };
