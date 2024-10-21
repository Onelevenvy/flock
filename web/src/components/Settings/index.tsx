"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
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
  const workplaceGroupItems = (() => {
    return [
      {
        key: "provider",
        name: t("setting.setting.modelProvider"),
        icon: <RiBox3Line />,
        activeIcon: <BsBoxFill color="#155eef" />,
      },
      {
        key: "members",
        name: t("setting.setting.member"),
        icon: <RiTeamLine />,
        activeIcon: <RiTeamFill color="#155eef" />,
      },
      {
        key: "appearance",
        name: t("setting.setting.theme"),
        icon: <BsSun />,
        activeIcon: <BsSunFill color="#155eef" />,
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
          activeIcon: <RiAccountBoxFill color="#155eef" />,
        },
        {
          key: "password",
          name: t("setting.setting.password"),
          icon: <RiLockPasswordLine />,
          activeIcon: <RiLockPasswordFill color="#155eef" />,
        },
        {
          key: "language",
          name: t("setting.setting.language"),
          icon: <MdLanguage />,
          activeIcon: <LuLanguages color="#155eef" />,
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
    (item) => item.key === activeMenu,
  );

  return (
    <>
      <Flex mr={5}>
        <Box
          width={{ base: "44px", sm: "200px" }}
          px={{ base: "1px", sm: "4" }}
          py="4"
          border="1px solid"
          borderColor="gray.100"
          flexDir="column"
          alignItems={{ base: "center", sm: "flex-start" }}
        >
          <Text
            mb="8"
            ml={{ base: "0", sm: "2" }}
            fontSize={{ base: "sm", sm: "base" }}
            fontWeight="medium"
            lineHeight="6"
            color="gray.900"
          >
            {t("setting.modal.setting")}
          </Text>
          <Box width="full">
            {menuItems.map((menuItem) => (
              <Box key={menuItem.key} mb="4">
                <Text
                  px="2"
                  mb="6px"
                  fontSize="10px"
                  fontWeight="medium"
                  color="gray.500"
                >
                  {menuItem.name}
                </Text>

                <Box>
                  {menuItem.items.map((item) => (
                    <Flex
                      key={item.key}
                      alignItems="center"
                      h="37px"
                      mb="2px"
                      cursor="pointer"
                      rounded="lg"
                      bg={activeMenu === item.key ? "#eff4ff" : "transparent"}
                      _hover={{ bg: "primary.50" }}
                      onClick={() => setActiveMenu(item.key)}
                      fontWeight={
                        activeMenu === item.key ? "semibold" : "light"
                      }
                    >
                      <Box mx={1}>
                        {activeMenu === item.key ? item.activeIcon : item.icon}
                      </Box>
                      <Text
                        color={activeMenu === item.key ? "#155eef" : "gray"}
                      >
                        {item.name}
                      </Text>
                    </Flex>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        <Box ref={scrollRef} width="824px" h="720px" pb="4" overflowY="auto">
          <Flex
            position="sticky"
            top="0"
            px="6"
            py="4"
            alignItems="center"
            h="14"
            mb="4"
            bg="white"
            color="gray.900"
            fontWeight="medium"
            zIndex="20"
          >
            <Box>{activeItem?.name}</Box>
            {activeItem?.description && (
              <Box ml="2" fontSize="xs" color="gray.600">
                {activeItem?.description}
              </Box>
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
    </>
    // Todo 非管理员提示没有成员及模型管理界面的条件渲染，渲染提示没有权限，目前是空白
  );
}
