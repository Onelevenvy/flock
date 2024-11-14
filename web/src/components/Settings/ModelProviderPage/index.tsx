import { Box, Flex, SimpleGrid, Spinner, useColorModeValue } from "@chakra-ui/react";
import { useQuery } from "react-query";

import type { ApiError } from "@/client/core/ApiError";
import { ProviderService } from "@/client/services/ProviderService";
import { ModelProvider } from "@/contexts/modelprovider";
import useCustomToast from "@/hooks/useCustomToast";

import ModelProviderCard from "./ProviderCard";

export default function ModelProviderPage() {
  const showToast = useCustomToast();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  const {
    data: providers,
    isLoading,
    isError,
    error,
  } = useQuery("provider", () => ProviderService.readProviderListWithModels());

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  return (
    <>
      {isLoading ? (
        <Flex 
          justify="center" 
          align="center" 
          height="100vh" 
          width="full"
          bg="ui.bgMain"
        >
          <Spinner 
            size="xl" 
            color="ui.main" 
            thickness="3px"
            speed="0.8s"
          />
        </Flex>
      ) : (
        <Box 
          maxW="full" 
          w="full" 
          overflow="hidden"
          bg={bgColor}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
          p={6}
          transition="all 0.2s"
          boxShadow="sm"
          _hover={{
            boxShadow: "md",
            borderColor: "gray.200",
          }}
        >
          <SimpleGrid 
            columns={{ base: 1, md: 1 }} 
            spacing={6}
          >
            {providers?.providers.map((provider) => (
              <ModelProvider key={provider.id} value={provider}>
                <ModelProviderCard providerName={provider.provider_name} />
              </ModelProvider>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </>
  );
}
