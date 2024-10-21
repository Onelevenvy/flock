import { Box, Flex, SimpleGrid, Spinner } from "@chakra-ui/react";
import { useQuery } from "react-query";

import type { ApiError } from "@/client/core/ApiError";
import { ProviderService } from "@/client/services/ProviderService";
import { ModelProvider } from "@/contexts/modelprovider";
import useCustomToast from "@/hooks/useCustomToast";

import ModelProviderCard from "./ProviderCard";

export default function ModelProviderPage() {
  const {
    data: providers,
    isLoading,
    isError,
    error,
  } = useQuery("provider", () => ProviderService.readProviderListWithModels());

  const showToast = useCustomToast();

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;

    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  return (
    <>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box maxW="full" w="full" overflow={"hidden"}>
          <SimpleGrid columns={{ base: 1, md: 1 }} spacing="6">
            {providers?.providers.map((provider) => {
              return (
                <ModelProvider key={provider.id} value={provider}>
                  <ModelProviderCard providerName={provider.provider_name} />
                </ModelProvider>
              );
            })}
          </SimpleGrid>
        </Box>
      )}
    </>
  );
}
