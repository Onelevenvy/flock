import type { Viewport } from "next";
import { StrictMode } from "react";
import Script from "next/script";

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

const LocaleLayout = ({ children }: { children: React.ReactNode }) => {
  // Get API URL from environment variable at server time
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="theme-color" content="#FFFFFF" />
        <link href="/favicon.ico" rel="icon" type="image/x-icon" />
      </head>
      <body>
        <StrictMode>
          <ChakraUIProviders>
            <QueryClientProviderWrapper>
              <ClientProvider>
                <I18nServer>{children}</I18nServer>
              </ClientProvider>
            </QueryClientProviderWrapper>
          </ChakraUIProviders>
        </StrictMode>
        
        {/* Load runtime config script using Next.js Script component */}
        <Script 
          src="/runtime-config.js" 
          strategy="beforeInteractive" 
          id="runtime-config"
        />
        
        {/* Inject API URL into window object with fallback */}
        <Script
          id="api-fallback"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.__RUNTIME_CONFIG__) {
                window.__RUNTIME_CONFIG__ = { API_URL: "${apiBaseUrl}" };
              }
              window.__API_BASE_URL__ = window.__RUNTIME_CONFIG__.API_URL;
            `
          }}
        />
      </body>
    </html>
  );
};

export default LocaleLayout; 