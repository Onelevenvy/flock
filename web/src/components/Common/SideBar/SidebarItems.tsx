import { Box, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FaToolbox } from "react-icons/fa";
import { FaBook } from "react-icons/fa6";
import {
  IoChatboxEllipsesOutline,
  IoChatbubbleEllipses,
} from "react-icons/io5";
import { LuBookCopy } from "react-icons/lu";
import { PiToolboxLight } from "react-icons/pi";
import { RiRobot2Fill, RiRobot2Line } from "react-icons/ri";
interface SidebarItemsProps {
  onClose?: () => void;
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const textColor = useColorModeValue("ui.main", "ui.white");
  const bgActive = useColorModeValue("white", "#4A5568");
  const currentPath = usePathname();
  const { t } = useTranslation();

  const items = [
  
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

    // {
    //   activeIcon: GiArchiveResearch,
    //   inactiveIcon: TbDeviceImacSearch,
    //   title: t("sidebar.research"),
    //   path: "/research",
    // },
  ];

  return (
    <Box display="flex" flexDirection="column">
      {items.map((item) => {
        const isActive = new RegExp(`^${item.path}`).test(currentPath);
        return (
          <Flex
            as={Link}
            href={item.path}
            key={item.title}
            w="full"
            p={2}
            mt={2}
            direction="column"
            alignItems="center"
            justifyContent="center"
            bg={isActive ? bgActive : "transparent"}
            color={textColor}
            borderRadius="lg"
            transition="all 0.2s"
            onClick={onClose}
            _hover={{
              bg: isActive ? bgActive : "gray.100",
              transform: "translateY(-1px)",
              boxShadow: "sm",
            }}
            _active={{
              transform: "translateY(0)",
            }}
          >
            <Icon
              as={isActive ? item.activeIcon : item.inactiveIcon}
              fontSize="28px"
              mb={1}
              color={isActive ? textColor : "gray.500"}
              transition="all 0.2s"
            />
            <Text
              fontSize="xs"
              color={isActive ? textColor : "gray.500"}
              fontWeight={isActive ? "600" : "500"}
              transition="all 0.2s"
            >
              {item.title}
            </Text>
          </Flex>
        );
      })}
    </Box>
  );
};

export default SidebarItems;
