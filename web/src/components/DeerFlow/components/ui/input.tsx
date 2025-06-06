import * as React from "react"
import { Input as ChakraInput, InputProps as ChakraInputProps } from "@chakra-ui/react"

export interface InputProps extends ChakraInputProps {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <ChakraInput
        ref={ref}
        variant="filled"
        bg="gray.50"
        _hover={{ bg: "gray.100" }}
        _focus={{ 
          bg: "gray.100",
          borderColor: "ui.main",
          borderWidth: "2px"
        }}
        size="md"
        className={className}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
