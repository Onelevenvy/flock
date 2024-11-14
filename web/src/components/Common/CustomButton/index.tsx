import { Button, Text, ButtonProps, ResponsiveValue } from "@chakra-ui/react";

interface CustomButtonProps extends Omit<ButtonProps, "variant"> {
  text: string;
  variant: ResponsiveValue<string>;
  leftIcon?: React.ReactElement;
  rightIcon?: React.ReactElement;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  text,
  variant,
  leftIcon,
  rightIcon,
  onClick,
  ...rest
}) => {
  const getButtonStyle = (v: string) => {
    switch (v) {
      case "blue":
        return {
          bg: "ui.main",
          color: "white",
          border: "none",
          _hover: { 
            bg: "blue.500",
            transform: "translateY(-1px)",
            boxShadow: "md",
          },
          _active: {
            bg: "blue.600",
            transform: "translateY(0)",
          },
        };
      case "white":
      default:
        return {
          bg: "white",
          color: "ui.main",
          border: "1px solid",
          borderColor: "gray.200",
          _hover: { 
            bg: "gray.50",
            transform: "translateY(-1px)",
            boxShadow: "sm",
          },
          _active: {
            bg: "gray.100",
            transform: "translateY(0)",
          },
        };
    }
  };

  return (
    <Button
      {...getButtonStyle(variant as string)}
      borderRadius="lg"
      onClick={onClick}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      size="sm"
      fontWeight="500"
      transition="all 0.2s"
      {...rest}
    >
      <Text>{text}</Text>
    </Button>
  );
};

export default CustomButton;
