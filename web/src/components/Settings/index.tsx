"use client";

import { Box, Flex, Text, VStack, useColorModeValue } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsBoxFill, BsSun, BsSunFill } from "react-icons/bs";
import { LuLanguages } from "react-icons/lu";
import { MdLanguage } from "react-icons/md";
import {
  RiAccountBoxFill,
  RiAccountBoxLine,
  RiBox3Line,
  RiLockPasswordFill,
  RiLockPasswordLine,
  RiTeamFill,
  RiTeamLine,
} from "react-icons/ri";

import useAuth from "@/hooks/useAuth";

import AppearancePage from "./AcountPage/Appearance";
import ChangePasswordPage from "./AcountPage/ChangePassword";
import LanguagePage from "./LanguagePage";
import MembersPage from "./MembersPage";
import ModelProviderPage from "./ModelProviderPage";
import UserInfoPage from "./UserInfoPage";

type IAccountSettingProps = {
  activeTab?: string;
};

type GroupItem = {
  key: string;
  name: string;
  description?: string;
  icon: JSX.Element;
  activeIcon: JSX.Element;
};

export default function AccountSetting({
  activeTab = "members",
}: IAccountSettingProps) {
  const [activeMenu, setActiveMenu] = useState(activeTab);
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const isAdmin = currentUser?.is_superuser ? true : false;

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const menuBgColor = useColorModeValue("gray.50", "gray.700");
  const menuHoverBgColor = useColorModeValue("blue.50", "gray.600");
  const menuActiveColor = useColorModeValue("ui.main", "blue.300");

  const workplaceGroupItems = (() => {
    return [
      {
        key: "provider",
        name: t("setting.setting.modelProvider"),
        icon: <RiBox3Line />,
        activeIcon: <BsBoxFill color={menuActiveColor} />,
      },
      {
        key: "members",
        name: t("setting.setting.member"),
        icon: <RiTeamLine />,
        activeIcon: <RiTeamFill color={menuActiveColor} />,
      },
      {
        key: "appearance",
        name: t("setting.setting.theme"),
        icon: <BsSun />,
        activeIcon: <BsSunFill color={menuActiveColor} />,
      },
    ].filter((item) => !!item.key) as GroupItem[];
  })();

  const menuItems = [
    {
      key: "workspace-group",
      name: t("setting.setting.workSpace"),
      items: workplaceGroupItems,
    },
    {
      key: "account-group",
      name: t("setting.setting.account"),
      items: [
        {
          key: "account",
          name: t("setting.setting.myAccount"),
          icon: <RiAccountBoxLine />,
          activeIcon: <RiAccountBoxFill color={menuActiveColor} />,
        },
        {
          key: "password",
          name: t("setting.setting.password"),
          icon: <RiLockPasswordLine />,
          activeIcon: <RiLockPasswordFill color={menuActiveColor} />,
        },
        {
          key: "language",
          name: t("setting.setting.language"),
          icon: <MdLanguage />,
          activeIcon: <LuLanguages color={menuActiveColor} />,
        },
      ],
    },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const targetElement = scrollRef.current;
    const scrollHandle = (e: Event) => {
      const userScrolled = (e.target as HTMLDivElement).scrollTop > 0;
      setScrolled(userScrolled);
    };

    targetElement?.addEventListener("scroll", scrollHandle);
    return () => {
      targetElement?.removeEventListener("scroll", scrollHandle);
    };
  }, []);

  const activeItem = [...menuItems[0].items, ...menuItems[1].items].find(
    (item) => item.key === activeMenu
  );

  return (
    <Flex mr={5}>
      <Box
        width={{ base: "44px", sm: "200px" }}
        px={{ base: "1px", sm: "4" }}
        py="4"
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        flexDir="column"
        alignItems={{ base: "center", sm: "flex-start" }}
        transition="all 0.2s"
        boxShadow="sm"
        _hover={{
          boxShadow: "md",
          borderColor: "gray.200",
        }}
      >
        <Text
          mb="8"
          ml={{ base: "0", sm: "2" }}
          fontSize={{ base: "sm", sm: "base" }}
          fontWeight="600"
          color="gray.800"
        >
          {t("setting.modal.setting")}
        </Text>

        <VStack spacing={4} align="stretch" w="full">
          {menuItems.map((menuItem) => (
            <Box key={menuItem.key}>
              <Text
                px="2"
                mb="2"
                fontSize="xs"
                fontWeight="500"
                color="gray.500"
                textTransform="uppercase"
              >
                {menuItem.name}
              </Text>

              <VStack spacing={1} align="stretch">
                {menuItem.items.map((item) => (
                  <Flex
                    key={item.key}
                    alignItems="center"
                    h="37px"
                    px={3}
                    cursor="pointer"
                    rounded="lg"
                    bg={activeMenu === item.key ? menuBgColor : "transparent"}
                    color={activeMenu === item.key ? menuActiveColor : "gray.600"}
                    fontWeight={activeMenu === item.key ? "600" : "500"}
                    transition="all 0.2s"
                    _hover={{
                      bg: menuHoverBgColor,
                      transform: "translateX(2px)",
                    }}
                    onClick={() => setActiveMenu(item.key)}
                  >
                    <Box mr={3}>
                      {activeMenu === item.key ? item.activeIcon : item.icon}
                    </Box>
                    <Text>{item.name}</Text>
                  </Flex>
                ))}
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      <Box
        ref={scrollRef}
        flex={1}
        h="720px"
        pb="4"
        overflowY="auto"
        ml={6}
        sx={{
          "&::-webkit-scrollbar": {
            width: "4px",
          },
          "&::-webkit-scrollbar-track": {
            bg: "gray.50",
          },
          "&::-webkit-scrollbar-thumb": {
            bg: "gray.300",
            borderRadius: "full",
          },
        }}
      >
        <Flex
          position="sticky"
          top="0"
          px="6"
          py="4"
          alignItems="center"
          h="14"
          mb="4"
          bg={bgColor}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
          boxShadow={scrolled ? "sm" : "none"}
          transition="all 0.2s"
          zIndex="20"
        >
          <Text fontSize="lg" fontWeight="600" color="gray.800">
            {activeItem?.name}
          </Text>
          {activeItem?.description && (
            <Text ml="2" fontSize="sm" color="gray.600">
              {activeItem?.description}
            </Text>
          )}
        </Flex>

        <Box px={{ base: "4", sm: "8" }} pt="2" w="full">
          {activeMenu === "account" && <UserInfoPage />}
          {activeMenu === "members" && isAdmin && <MembersPage />}
          {activeMenu === "appearance" && <AppearancePage />}
          {activeMenu === "password" && <ChangePasswordPage />}
          {activeMenu === "provider" && isAdmin && <ModelProviderPage />}
          {activeMenu === "language" && <LanguagePage />}
        </Box>
      </Box>
    </Flex>
  );
}
