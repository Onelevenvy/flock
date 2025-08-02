// src/app/LocaleLayout.tsx (或你的文件路径)

import type { Viewport } from "next";
import { StrictMode } from "react";
import Script from "next/script";
import { Geist } from "next/font/google";

import I18nServer from "@/components/i18n/i18n-server";
import { ChakraUIProviders } from "@/components/Provider/ChakraUIProvider";
import QueryClientProviderWrapper from "@/components/Provider/QueryClientProvider";
import ClientProvider from "../components/Provider/ClientProviders";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const LocaleLayout = ({ children }: { children: React.ReactNode }) => {


  return (
    <html
      lang="en"
      className={`h-full ${geist.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#FFFFFF" />
        <link href="/favicon.ico" rel="icon" type="image/x-icon" />
        <Script id="markdown-it-fix" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined' && typeof window.isSpace === 'undefined') {
              window.isSpace = function(code) {
                return code === 0x20 || code === 0x09 || code === 0x0A || code === 0x0B || code === 0x0C || code === 0x0D;
              };
            }
          `}
        </Script>
      </head>
      <body className="bg-app">
        <StrictMode>
          <ChakraUIProviders>
            <QueryClientProviderWrapper>
              <ClientProvider>
                <I18nServer>{children}</I18nServer>
              </ClientProvider>
            </QueryClientProviderWrapper>
          </ChakraUIProviders>
        </StrictMode>
        
     
        <Script id="api-url-config" strategy="beforeInteractive">
          {`window.__API_BASE_URL__ = "/api";`}
        </Script>
      </body>
    </html>
  );
};

export default LocaleLayout;