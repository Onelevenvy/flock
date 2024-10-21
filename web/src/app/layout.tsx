import type { Viewport } from "next";
import { StrictMode } from "react";

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
      </body>
    </html>
  );
};

export default LocaleLayout;
