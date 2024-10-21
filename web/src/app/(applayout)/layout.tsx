// components/Layout.tsx
"use client";
import { Box, Flex, useColorModeValue } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect } from "react";

import Sidebar from "@/components/Common/SideBar";
import TopBar from "@/components/Common/TopBar";
import useAuth, { isLoggedIn } from "@/hooks/useAuth";

function Layout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const router = useRouter();
  const bgmain = useColorModeValue("ui.bgMain", "ui.bgMainDark");
  const currentPath = usePathname(); // 获取当前路径

  // 使用正则表达式检查路径
  const shouldRenderTopBar = !/(\/teams\/\d+|\/knowledge\/\d+)/.test(
    currentPath
  );

  useEffect(() => {
    if (!isLoggedIn()) {
      // 如果用户未登录，重定向到登录页面
      router.push("/login");
    }
  }, [router]);

  if (isLoading || !isLoggedIn()) {
    // 如果用户未登录或正在加载，不渲染任何内容
    return null;
  }

  return (
    <>
      <Box
        bg={bgmain}
        borderRadius={"md"}
        minH={"100vh"}
        h={"100vh"}
        overflow={"hidden"}
      >
        <Flex
          maxW="full"
          maxH="full"
          h="full"
          position="relative"
          overflow="hidden"
          flexDirection={"row"}
        >
          <Box
            h="full"
            maxH="full"
            minW="5vw"
            w="5vw"
            maxW="5vw"
            justifyItems={"center"}
            justifyContent={"center"}
            alignItems={"center"}
            alignContent={"center"}
          >
            <Sidebar />
          </Box>

          <Box
            display="flex"
            w="95vw"
            maxW="95vw"
            minW="95vw"
            flexDirection={"column"}
          >
            {shouldRenderTopBar && <TopBar />}
            <Box
              w="95vw"
              maxW="95vw"
              minW="95vw"
              overflow={"auto"}
              maxH="full"
              h="full"
              borderRadius={"md"}
            >
              {children}
            </Box>
          </Box>
        </Flex>
      </Box>
    </>
  );
}

export default Layout;
