import { Icon, Input, InputGroup, InputLeftElement } from "@chakra-ui/react";
import React from "react";
import { FaSearch } from "react-icons/fa";

const Search = () => {
  return (
    <InputGroup 
      w={{ base: "100%", md: "auto" }}
      transition="all 0.2s"
      _hover={{ transform: "translateY(-1px)" }}
    >
      <InputLeftElement pointerEvents="none">
        <Icon 
          as={FaSearch} 
          color="gray.400"
          transition="all 0.2s"
        />
      </InputLeftElement>
      <Input
        type="text"
        placeholder="Search"
        fontSize={{ base: "sm", md: "md" }}
        borderRadius="lg"
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        _hover={{
          borderColor: "gray.300",
          boxShadow: "sm",
        }}
        _focus={{
          borderColor: "blue.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
        }}
        transition="all 0.2s"
      />
    </InputGroup>
  );
};

export default Search;