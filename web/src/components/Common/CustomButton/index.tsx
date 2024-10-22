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
          bg: "#155aef",
          color: "white",
          border: "none",
          _hover: { backgroundColor: "#1c86ee" },
        };
      case "white":
      default:
        return {
          bg: "white",
          color: "#155aef",
          border: "1px solid #d1d5db",
          _hover: { backgroundColor: "#eff4ff" },
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
      {...rest}
    >
      <Text>{text}</Text>
    </Button>
  );
};

export default CustomButton;
