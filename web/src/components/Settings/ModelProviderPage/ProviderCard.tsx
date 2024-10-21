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
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      boxShadow="md"
      bg={"#e5e7eb"}
      w="full"
      minW="full"
    >
      <Box display={"flex"} flexDirection={"column"}>
        <Box
          display={"flex"}
          flexDirection={"row"}
          alignItems={"end"}
          justifyContent={"space-between"}
          pl="3"
          my="2"
        >
          <Box>
            <ModelProviderIconLong
              modelprovider_name={providerName}
              h="12"
              w="40"
            />
            <Wrap spacing={2} mt={2}>
              {allCategories.map((category, index) => (
                <WrapItem key={index}>
                  <Tag
                    size="sm"
                    colorScheme="gray"
                    variant="outline"
                    color={"black"}
                  >
                    {category.toUpperCase()}
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          </Box>
          <Box mr="2">
            <Button
              size={"sm"}
              onClick={() => setIsModalOpen(true)}
              leftIcon={<CiSettings />}
            >
              {t("setting.modal.setting")}
            </Button>
            <ProviderUpdate
              isModalOpen={isModalOpen}
              setIsModalOpen={setIsModalOpen}
            />
          </Box>
        </Box>

        <Box>
          <Box bg={"#edeef1"}>
            <Button
              onClick={toggleCollapse}
              size={"sm"}
              bg="transparent"
              leftIcon={
                isOpen ? (
                  <MdOutlineKeyboardDoubleArrowUp />
                ) : (
                  <MdOutlineKeyboardDoubleArrowDown />
                )
              }
            >
              {isOpen
                ? t("setting.setting.hidemodel")
                : t("setting.setting.showmodel")}
            </Button>
          </Box>
          <Collapse in={isOpen}>
            <VStack align="start" bg={"#edeef1"} spacing={2}>
              {providerInfo?.models.map((model, index) => (
                <Box
                  key={index}
                  display={"flex"}
                  flexDirection={"row"}
                  alignItems={"center"}
                  w="full"
                  pl="3"
                  pr="3"
                  justifyContent="space-between"
                >
                  <HStack spacing={2}>
                    <ModelProviderIcon
                      modelprovider_name={providerName}
                      w={4}
                      h={4}
                    />
                    <Text>{model.ai_model_name}</Text>
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
                          colorScheme="gray"
                          variant="outline"
                        >
                          {category.toUpperCase()}
                        </Tag>
                      ))}
                   
                  </HStack>
                </Box>
              ))}
            </VStack>
          </Collapse>
        </Box>
      </Box>
    </Box>
  );
};

export default ModelProviderCard;
