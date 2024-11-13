// components/Layout.tsx
"use client";
import { Box, Flex } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect } from "react";

import Sidebar from "@/components/Common/SideBar";
import TopBar from "@/components/Common/TopBar";
import useAuth, { isLoggedIn } from "@/hooks/useAuth";

function Layout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const router = useRouter();
  const currentPath = usePathname();

  const shouldRenderTopBar = !/(\/teams\/\d+|\/knowledge\/\d+)/.test(currentPath);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
    }
  }, [router]);

  if (isLoading || !isLoggedIn()) {
    return null;
  }

  return (
    <Box h="100vh" overflow="hidden">
      <Flex h="full" position="relative">
        {/* Sidebar */}
        <Box
          h="full"
          w="5vw"
          minW="5vw"
          maxW="5vw"
          bg="white"
          borderRight="1px solid"
          borderColor="gray.100"
        >
          <Sidebar />
        </Box>

        {/* Main Content Area */}
        <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
          {/* TopBar */}
          {shouldRenderTopBar && (
            <Box h="70px" flexShrink={0}>
              <TopBar />
            </Box>
          )}

          {/* Content Area */}
          <Box
            flex={1}
            overflow="hidden"
            bg="ui.bgMain"
          >
            {children}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}

export default Layout;
