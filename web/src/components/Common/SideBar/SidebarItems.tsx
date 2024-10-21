import { Box, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BsRobot } from "react-icons/bs";
import { FaToolbox } from "react-icons/fa";
import { FaBook, FaHouseChimney } from "react-icons/fa6";
import { FiHome } from "react-icons/fi";
import {
  IoChatboxEllipsesOutline,
  IoChatbubbleEllipses,
} from "react-icons/io5";
import { LuBookCopy } from "react-icons/lu";
import { PiToolboxLight } from "react-icons/pi";
import { RiRobot2Fill, RiRobot2Line } from "react-icons/ri";

import useAuth from "../../../hooks/useAuth";

interface SidebarItemsProps {
  onClose?: () => void;
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const textColor = useColorModeValue("ui.main", "ui.white");
  const bgActive = useColorModeValue("white", "#4A5568");
  const currentPath = usePathname(); // 获取当前路径
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const superuser_items = [
    {
      activeIcon: FaHouseChimney,
      inactiveIcon: FiHome,
      title: t("sidebar.home"),
      path: "/dashboard",
    },
    {
      activeIcon: IoChatbubbleEllipses,
      inactiveIcon: IoChatboxEllipsesOutline,
      title: t("sidebar.chat"),
      path: "/playground",
    },
    {
      activeIcon: RiRobot2Fill,
      inactiveIcon: RiRobot2Line,
      title: t("sidebar.team"),
      path: "/teams",
    },
    {
      activeIcon: FaToolbox,
      inactiveIcon: PiToolboxLight,
      title: t("sidebar.tools"),
      path: "/tools",
    },
    {
      activeIcon: FaBook,
      inactiveIcon: LuBookCopy,
      title: t("sidebar.knowledge"),
      path: "/knowledge",
    },
  ];

  const nosuperuser_items = [
    {
      activeIcon: FiHome,
      inactiveIcon: FiHome,
      title: "主页",
      path: "/dashboard",
    },
    {
      activeIcon: BsRobot,
      inactiveIcon: BsRobot,
      title: "会话",
      path: "/playground",
    },
  ];
  const items = currentUser?.is_superuser ? superuser_items : nosuperuser_items;

  const listItems = items.map((item) => {
    // const isActive = currentPath === item.path;
    const isActive = new RegExp(`^${item.path}`).test(currentPath);

    return (
      <Flex
        as={Link}
        href={item.path}
        w="100%"
        p={2}
        mt={2}
        key={item.title}
        style={{
          background: isActive ? bgActive : "transparent", // 根据当前路径设置背景
          borderRadius: "6px",
        }}
        color={textColor}
        onClick={onClose}
        direction="column" // 使图标和文字垂直排列
        alignItems="center" // 水平居中对齐
        justifyContent="center" // 垂直居中对齐
      >
        <Icon
          as={isActive ? item.activeIcon : item.inactiveIcon}
          fontSize="28px"
          mb={1}
          color={isActive ? textColor : "gray.500"}
        />
        <Text fontSize={"10px"} color={isActive ? textColor : "gray.500"}>
          {item.title}
        </Text>
      </Flex>
    );
  });

  return (
    <>
      <Box display="flex" flexDirection={"column"}>
        {listItems}
      </Box>
    </>
  );
};

export default SidebarItems;
