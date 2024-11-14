import { Button, Icon, type ButtonProps } from "@chakra-ui/react";
import React from "react";

interface CustomButtonProps extends Omit<ButtonProps, "variant"> {
  text: string;
  variant?: "blue" | "white" | "danger" | "primary" | "ghost";
  leftIcon?: React.ReactElement;
  rightIcon?: React.ReactElement;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  text,
  variant = "blue",
  onClick,
  leftIcon,
  rightIcon,
  isLoading,
  isDisabled,
  width,
  mt,
  type = "button",
  size = "md",
  ...rest
}) => {
  const getButtonStyles = () => {
    const baseStyles = {
      transition: "all 0.2s",
      _hover: {
        transform: "translateY(-1px)",
        boxShadow: "md",
      },
      _active: {
        transform: "translateY(0)",
      },
    };

    switch (variant) {
      case "blue":
        return {
          ...baseStyles,
          bg: "ui.main",
          color: "white",
          borderRadius: "lg",
          _hover: {
            ...baseStyles._hover,
            bg: "blue.500",
          },
          _active: {
            ...baseStyles._active,
            bg: "blue.600",
          },
        };
      case "white":
        return {
          ...baseStyles,
          bg: "white",
          color: "#2762e7",
          border: "1px solid",
          borderColor: "gray.200",
          borderRadius: "lg",
          _hover: {
            ...baseStyles._hover,
            bg: "gray.50",
          },
        };
      case "danger":
        return {
          ...baseStyles,
          bg: "red.500",
          color: "white",
          borderRadius: "lg",
          _hover: {
            ...baseStyles._hover,
            bg: "red.600",
          },
        };
      case "primary":
        return {
          ...baseStyles,
          bg: "ui.main",
          color: "white",
          borderRadius: "lg",
          _hover: {
            ...baseStyles._hover,
            bg: "blue.500",
          },
          _active: {
            ...baseStyles._active,
            bg: "blue.600",
          },
        };
      case "ghost":
        return {
          ...baseStyles,
          bg: "transparent",
          color: "gray.600",
          _hover: {
            ...baseStyles._hover,
            bg: "gray.50",
          },
        };
      default:
        return baseStyles;
    }
  };

  return (
    <Button
      onClick={onClick}
      isLoading={isLoading}
      isDisabled={isDisabled}
      leftIcon={leftIcon && <Icon as={() => leftIcon} />}
      rightIcon={rightIcon && <Icon as={() => rightIcon} />}
      width={width}
      mt={mt}
      type={type}
      size={size}
      fontWeight="500"
      {...getButtonStyles()}
      {...rest}
    >
      {text}
    </Button>
  );
};

export default CustomButton;
