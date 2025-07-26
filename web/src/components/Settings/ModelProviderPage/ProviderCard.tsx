import {
  Box,
  Button,
  Collapse,
  Text,
  VStack,
  HStack,
  Tag,
  Wrap,
  WrapItem,
  useColorModeValue,
  Icon,
  Switch,
} from "@chakra-ui/react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "react-query";
import { CiSettings } from "react-icons/ci";
import { FaEye } from "react-icons/fa";
import { TbPointFilled } from "react-icons/tb";
import {
  MdOutlineKeyboardDoubleArrowDown,
  MdOutlineKeyboardDoubleArrowUp,
} from "react-icons/md";

import type { ApiError } from "@/client/core/ApiError";
import { ModelService } from "@/client/services/ModelService";
import ModelProviderIcon from "@/components/Icons/models";
import ModelProviderIconLong from "@/components/Icons/Providers";
import { useModelProviderContext } from "@/contexts/modelprovider";
import useCustomToast from "@/hooks/useCustomToast";

import ProviderUpdate from "./ProviderUpdate";

interface ModelCardProps {
  providerName: string;
}

const ModelProviderCard: React.FC<ModelCardProps> = ({ providerName }) => {
  const providerInfo = useModelProviderContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const headerBg = useColorModeValue("ui.inputbgcolor", "gray.700");
  const modelBg = useColorModeValue("gray.50", "gray.700");
  const offlineColor = useColorModeValue("gray.400", "gray.500");
  const offlineBg = useColorModeValue("gray.100", "gray.700");

  const toggleCollapse = () => setIsOpen(!isOpen);

  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    providerInfo?.models.forEach((model) => {
      model.categories.forEach((category) => {
        if (category !== "chat") {
          categories.add(category);
        }
      });
    });
    return Array.from(categories);
  }, [providerInfo?.models]);

  const updateModelOnlineMutation = useMutation(
    async ({ modelId, isOnline }: { modelId: number; isOnline: boolean }) => {
      return await ModelService.updateModelOnlineStatus({
        modelId,
        isOnline,
      });
    },
    {
      onSuccess: () => {
        showToast("Success", "Model status updated.", "success");
        queryClient.invalidateQueries("provider");
      },
      onError: (error: ApiError) => {
        const errDetail = error.body?.detail;
        showToast("Update Failed", `${errDetail || "Could not update model status."}`, "error");
      },
    },
  );

  const handleModelStatusChange = (modelId: number, isOnline: boolean) => {
    updateModelOnlineMutation.mutate({ modelId, isOnline });
  };

  return (
    <Box
      borderRadius="xl"
      border="1px solid"
      borderColor={borderColor}
      bg={bgColor}
      overflow="hidden"
      transition="all 0.2s"
      boxShadow="sm"
      _hover={{
        boxShadow: "md",
        borderColor: "gray.200",
      }}
    >
      <Box p={6}>
        <HStack justify="space-between" align="start" mb={4}>
          <VStack align="start" spacing={3}>
            <ModelProviderIconLong
              modelprovider_name={providerName}
              h="12"
              w="40"
            />
            <Text fontWeight="bold" fontSize="sm">
              {providerInfo?.description}
            </Text>
            <Wrap spacing={2}>
              {allCategories.map((category, index) => (
                <WrapItem key={index}>
                  <Tag
                    size="sm"
                    variant="subtle"
                    colorScheme="blue"
                    borderRadius="full"
                  >
                    <Text fontWeight="500">{category.toUpperCase()}</Text>
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          </VStack>

          <VStack align="end" spacing={1}>
             <HStack align="center" spacing={1}>
                <Text fontSize="xs" color="gray.500">API KEY</Text>
                <Icon as={TbPointFilled} boxSize={5} color={providerInfo?.is_available ? 'green.400' : 'orange.400'} />
            </HStack>
            <Button
              size="sm"
              leftIcon={<CiSettings />}
              onClick={() => setIsModalOpen(true)}
              variant="ghost"
              transition="all 0.2s"
              _hover={{
                bg: "gray.100",
                transform: "translateY(-1px)",
              }}
              _active={{
                transform: "translateY(0)",
              }}
            >
              {t("setting.modal.setting")}
            </Button>
          </VStack>

        </HStack>

        <Box>
          <Button
            onClick={toggleCollapse}
            size="sm"
            variant="ghost"
            leftIcon={
              isOpen ? (
                <MdOutlineKeyboardDoubleArrowUp />
              ) : (
                <MdOutlineKeyboardDoubleArrowDown />
              )
            }
            w="full"
            justifyContent="flex-start"
            bg={headerBg}
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
            }}
          >
            {isOpen
              ? t("setting.setting.hidemodel")
              : t("setting.setting.showmodel")}
          </Button>

          <Collapse in={isOpen}>
            <VStack align="stretch" spacing={2} mt={2}>
              {providerInfo?.models.map((model, index) => (
                <Box
                  key={index}
                  p={4}
                  bg={model.is_online ? modelBg : offlineBg}
                  color={model.is_online ? 'inherit' : offlineColor}
                  borderRadius="lg"
                  transition="all 0.2s"
                  _hover={{
                    bg: "gray.100",
                  }}
                >
                  <HStack justify="space-between">
                    <HStack spacing={3}>
                      <ModelProviderIcon
                        modelprovider_name={providerName}
                        boxSize={4}
                      />
                      <Text fontWeight="500">{model.ai_model_name}</Text>
                    </HStack>

                    <HStack spacing={4}>
                      {model.capabilities.includes("vision") && (
                        <Icon as={FaEye} color="gray.500" />
                      )}
                      <Wrap spacing={2} justify="flex-end">
                        {model.categories
                          .filter((cat) => cat !== "chat")
                          .map((category, catIndex) => (
                            <WrapItem key={catIndex}>
                              <Tag
                                size="sm"
                                variant="subtle"
                                colorScheme="blue"
                                borderRadius="full"
                              >
                                <Text fontWeight="500">
                                  {category.toUpperCase()}
                                </Text>
                              </Tag>
                             </WrapItem>
                          ))}
                      </Wrap>
                      <Switch
                        isChecked={model.is_online}
                        onChange={(e) => handleModelStatusChange(model.id, e.target.checked)}
                        isDisabled={!providerInfo?.is_available}
                      />
                    </HStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </Collapse>
        </Box>
      </Box>

      <ProviderUpdate
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      />
    </Box>
  );
};

export default ModelProviderCard;