import { Button, Text, ButtonProps } from "@chakra-ui/react";
import React from 'react';

interface CustomButtonProps extends ButtonProps {
  text: string;
  variant: 'blue' | 'white';
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
  const isBlue = variant === 'blue';

  return (
    <Button
      bg={isBlue ? "#155aef" : "white"}
      color={isBlue ? "white" : "#155aef"}
      borderRadius="lg"
      border={isBlue ? "none" : "1px solid #d1d5db"}
      onClick={onClick}
      _hover={{ backgroundColor: isBlue ? "#1c86ee" : "#eff4ff" }}
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
