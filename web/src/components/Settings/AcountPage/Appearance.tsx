import {
  Box,
  Badge,
  Container,
  Radio,
  RadioGroup,
  Stack,
  useColorMode,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { BsSun, BsMoon } from "react-icons/bs";

const AppearancePage = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { t } = useTranslation();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  return (
    <Container maxW="full">
      <Box
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
        <VStack align="stretch" spacing={6}>
          <RadioGroup onChange={toggleColorMode} value={colorMode}>
            <Stack spacing={4}>
              <Box
                p={4}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                transition="all 0.2s"
                _hover={{ bg: "gray.50" }}
              >
                <Radio value="light" colorScheme="blue" size="lg">
                  <Stack direction="row" align="center" spacing={3}>
                    <Box p={2} borderRadius="md" bg="blue.50" color="blue.500">
                      <BsSun size={18} />
                    </Box>
                    <Box>
                      <Text fontWeight="500" color="gray.700">
                        {t("setting.setting.themelight")}
                      </Text>
                      <Badge
                        ml={2}
                        colorScheme="blue"
                        variant="subtle"
                        fontSize="xs"
                        borderRadius="full"
                        px={2}
                        py={0.5}
                      >
                        Default
                      </Badge>
                    </Box>
                  </Stack>
                </Radio>
              </Box>

              <Box
                p={4}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                transition="all 0.2s"
                _hover={{ bg: "gray.50" }}
              >
                <Radio value="dark" colorScheme="blue" size="lg">
                  <Stack direction="row" align="center" spacing={3}>
                    <Box
                      p={2}
                      borderRadius="md"
                      bg="purple.50"
                      color="purple.500"
                    >
                      <BsMoon size={18} />
                    </Box>
                    <Text fontWeight="500" color="gray.700">
                      {t("setting.setting.themedark")}
                    </Text>
                  </Stack>
                </Radio>
              </Box>
            </Stack>
          </RadioGroup>
        </VStack>
      </Box>
    </Container>
  );
};

export default AppearancePage;
