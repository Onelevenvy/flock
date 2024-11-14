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
} from "@chakra-ui/react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CiSettings } from "react-icons/ci";
import { FaEye } from "react-icons/fa";
import {
  MdOutlineKeyboardDoubleArrowDown,
  MdOutlineKeyboardDoubleArrowUp,
} from "react-icons/md";

import ModelProviderIcon from "@/components/Icons/models";
import ModelProviderIconLong from "@/components/Icons/Providers";
import { useModelProviderContext } from "@/contexts/modelprovider";

import ProviderUpdate from "./ProviderUpdate";

interface ModelCardProps {
  providerName: string;
}

const ModelProviderCard: React.FC<ModelCardProps> = ({ providerName }) => {
  const providerInfo = useModelProviderContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const headerBg = useColorModeValue("ui.inputbgcolor", "gray.700");
  const modelBg = useColorModeValue("gray.50", "gray.700");

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
            <Wrap spacing={2}>
              {allCategories.map((category, index) => (
                <WrapItem key={index}>
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
          </VStack>
          
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
        </HStack>

        <Box>
          <Button
            onClick={toggleCollapse}
            size="sm"
            variant="ghost"
            leftIcon={isOpen ? <MdOutlineKeyboardDoubleArrowUp /> : <MdOutlineKeyboardDoubleArrowDown />}
            w="full"
            justifyContent="flex-start"
            bg={headerBg}
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
            }}
          >
            {isOpen ? t("setting.setting.hidemodel") : t("setting.setting.showmodel")}
          </Button>

          <Collapse in={isOpen}>
            <VStack align="stretch" spacing={2} mt={2}>
              {providerInfo?.models.map((model, index) => (
                <Box
                  key={index}
                  p={4}
                  bg={modelBg}
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
                    
                    <HStack spacing={2}>
                      {model.capabilities.includes("vision") && (
                        <FaEye color="gray" />
                      )}
                      {model.categories
                        .filter((cat) => cat !== "chat")
                        .map((category, catIndex) => (
                          <Tag
                            key={catIndex}
                            size="sm"
                            variant="subtle"
                            colorScheme="blue"
                            borderRadius="full"
                          >
                            <Text fontWeight="500">
                              {category.toUpperCase()}
                            </Text>
                          </Tag>
                        ))}
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
