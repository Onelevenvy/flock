import {
  Badge,
  Container,
  Radio,
  RadioGroup,
  Stack,
  useColorMode,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

const AppearancePage = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { t } = useTranslation();

  return (
    <>
      <Container maxW="full">
        <RadioGroup onChange={toggleColorMode} value={colorMode}>
          <Stack>
            {/* TODO: Add system default option */}
            <Radio value="light" colorScheme="teal">
              {t("setting.setting.themedark")}
              <Badge ml="1" colorScheme="teal">
                Default
              </Badge>
            </Radio>
            <Radio value="dark" colorScheme="teal">
              {t("setting.setting.themelight")}
            </Radio>
          </Stack>
        </RadioGroup>
      </Container>
    </>
  );
};

export default AppearancePage;
